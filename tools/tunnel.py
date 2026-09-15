"""新店选品测算系统 公网穿透部署

链路:  fnOS 192.168.0.104:3020 --frpc--> 阿里云 8.148.212.41:7000(frps)
       --> 127.0.0.1:18901 --nginx--> xp.palmscm.com (80/443)

用法:  python tools/tunnel.py [step]
       step: frps | frpc | nginx | ssl | all (默认 all)
"""
import sys, io, time

import paramiko

try:
    from _secrets import (NAS_HOST, NAS_USER, NAS_PWD,
                          VPS_HOST, VPS_USER, VPS_PWD,
                          FRP_TOKEN, FRPS_WEB_PWD)
except ImportError:
    import os
    NAS_HOST = os.environ.get('XD_NAS_HOST', '')
    NAS_USER = os.environ.get('XD_NAS_USER', '')
    NAS_PWD = os.environ.get('XD_NAS_PWD', '')
    VPS_HOST = os.environ.get('XD_VPS_HOST', '')
    VPS_USER = os.environ.get('XD_VPS_USER', '')
    VPS_PWD = os.environ.get('XD_VPS_PWD', '')
    FRP_TOKEN = os.environ.get('XD_FRP_TOKEN', '')
    FRPS_WEB_PWD = os.environ.get('XD_FRPS_WEB_PWD', '')

VPS = dict(host=VPS_HOST, user=VPS_USER, pwd=VPS_PWD, timeout=30)
NAS = dict(host=NAS_HOST, user=NAS_USER, pwd=NAS_PWD, timeout=25)

TOKEN = FRP_TOKEN
REMOTE_PORT = 18901
DOMAIN = 'xp.palmscm.com'
CERT_DIR = '/www/server/panel/vhost/cert/xp.palmscm.com'
NAS_APP = '/vol1/1000/PATH/apps/xdxp-frpc'

FRPS_TOML = """# ============================================================
# frps (服务端) 配置 — 阿里云 8.148.212.41
# 安全策略：TLS加密 + Token认证 + localhost绑定 + 端口白名单
# ============================================================

bindPort = 7000

# === TLS 强制加密 ===
transport.tls.force = true

# === 认证令牌 ===
auth.token = "%s"

# === 安全关键配置：代理端口仅绑定 localhost ===
proxyBindAddr = "127.0.0.1"

# === 管理面板（仅 localhost 可访问） ===
webServer.addr = "127.0.0.1"
webServer.port = 7500
webServer.user = "admin"
webServer.password = "%s"

# === 日志 ===
log.to = "/var/log/frps.log"
log.level = "info"
log.maxDays = 7

# === 端口白名单 ===
allowPorts = [
  { start = 18899, end = 18899 },  # Amazon scrape proxy tunnel
  { start = 18900, end = 18900 },  # amazon proxy tunnel v2
  { start = 13306, end = 13306 },  # MySQL
  { start = 11433, end = 11433 },  # SQL Server
  { start = %d, end = %d },  # xdxp 新店选品测算系统
]

# === 性能调优 ===
maxPortsPerClient = 5
transport.tcpMux = true
transport.tcpMuxKeepaliveInterval = 60
""" % (TOKEN, FRPS_WEB_PWD, REMOTE_PORT, REMOTE_PORT)

FRPC_TOML = """# frpc — 新店选品测算系统 (xdxp)
serverAddr = "8.148.212.41"
serverPort = 7000

auth.token = "%s"

transport.tls.enable = true
transport.tcpMux = true
loginFailExit = false

log.to = "/var/log/frpc.log"
log.level = "info"
log.maxDays = 7

[[proxies]]
name = "xdxp"
type = "tcp"
localIP = "127.0.0.1"
localPort = 3020
remotePort = %d
""" % (TOKEN, REMOTE_PORT)

COMPOSE = """services:
  frpc:
    image: snowdreamtech/frpc:0.61.1
    container_name: xdxp-frpc
    restart: unless-stopped
    network_mode: host
    volumes:
      - ./frpc.toml:/etc/frp/frpc.toml:ro
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
"""

NGINX_CONF = """server
{
    listen 80;
    server_name %s;

    # acme / 宝塔验证目录
    location ^~ /.well-known/ {
        root /www/wwwroot/%s;
        default_type "text/plain";
    }

    # 全站强制 HTTPS（ACME 验证目录除外）
    location / {
        return 301 https://$host$request_uri;
    }

    access_log /www/wwwlogs/%s.log;
    error_log  /www/wwwlogs/%s.error.log;
}
""" % (DOMAIN, DOMAIN, DOMAIN, DOMAIN)


def conn(cfg):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(cfg['host'], 22, cfg['user'], cfg['pwd'],
              timeout=cfg['timeout'], allow_agent=False, look_for_keys=False)
    return c


def sh(c, cmd, timeout=120, quiet=False):
    i, o, e = c.exec_command(cmd, timeout=timeout)
    out = o.read().decode('utf-8', 'replace')
    err = e.read().decode('utf-8', 'replace')
    code = o.channel.recv_exit_status()
    if not quiet:
        print('  $ ' + cmd)
        if out.strip():
            print('    ' + out.rstrip().replace('\n', '\n    '))
        if err.strip():
            print('    [stderr] ' + err.rstrip().replace('\n', '\n    '))
    return code, out, err


def put(c, text, remote, mode=None):
    s = c.open_sftp()
    bio = io.BytesIO(text.encode('utf-8'))
    s.putfo(bio, remote)
    if mode is not None:
        s.chmod(remote, mode)
    s.close()
    print('  ↑ %s (%d bytes)' % (remote, len(text)))


def step_frps():
    print('\n[1/4] 配置 frps（放行远程端口 %d）' % REMOTE_PORT)
    c = conn(VPS)
    sh(c, 'cp /opt/frps/frps.toml /opt/frps/frps.toml.bak-%d' % int(time.time()), quiet=True)
    put(c, FRPS_TOML, '/opt/frps/frps.toml', 0o644)
    # 旧 frps 可能是手动/nohup 启动的，不在 systemd cgroup 内，restart 杀不掉 -> 先显式清理
    print('  · 清理残留 frps 进程')
    sh(c, 'pkill -f "/usr/local/bin/frps" 2>/dev/null; sleep 2; '
          'ss -lntp | grep -E ":7000|:7500" || echo "ports free"')
    sh(c, 'systemctl restart frps && sleep 3 && systemctl is-active frps')
    sh(c, 'ss -lntp | grep ":7000"')
    c.close()
    print('  ✓ frps 已重启')


def step_frpc():
    print('\n[2/4] 部署 frpc（fnOS → 阿里云）')
    c = conn(NAS)
    sh(c, 'mkdir -p %s' % NAS_APP)
    put(c, FRPC_TOML, NAS_APP + '/frpc.toml', 0o644)
    put(c, COMPOSE, NAS_APP + '/docker-compose.yml', 0o644)
    print('  · 拉取镜像 snowdreamtech/frpc（首次较慢）...')
    code, out, err = sh(c, 'cd %s && (docker images -q snowdreamtech/frpc | grep -q . || docker pull docker.1ms.run/snowdreamtech/frpc:latest) 2>&1 | tail -5' % NAS_APP, timeout=420)
    sh(c, 'docker images | grep -E "frpc|REPOSITORY"')
    # 若走了代理源，补打官方 tag
    sh(c, 'docker images -q docker.1ms.run/snowdreamtech/frpc:latest | grep -q . && '
          'docker tag docker.1ms.run/snowdreamtech/frpc:latest snowdreamtech/frpc:latest 2>/dev/null; echo tagged', quiet=True)
    sh(c, 'cd %s && docker compose up -d --force-recreate 2>&1 | tail -8' % NAS_APP, timeout=180)
    time.sleep(5)
    sh(c, 'docker ps --filter name=xdxp-frpc --format "{{.Names}} | {{.Status}}"')
    sh(c, 'docker logs --tail 12 xdxp-frpc 2>&1')
    c.close()
    print('  ✓ frpc 已启动')


def step_nginx():
    print('\n[3/4] 配置 nginx 反代 %s' % DOMAIN)
    c = conn(VPS)
    # 验证隧道是否已建立
    code, out, err = sh(c, 'ss -lntp | grep ":%d" || echo "TUNNEL_DOWN"' % REMOTE_PORT)
    if 'TUNNEL_DOWN' in out:
        print('  ✗ 隧道未建立，先检查 frpc')
    sh(c, 'mkdir -p /www/wwwroot/%s' % DOMAIN, quiet=True)
    sh(c, 'curl -s -o /dev/null -w "tunnel http status: %%{http_code}\\n" --noproxy "*" http://127.0.0.1:%d/' % REMOTE_PORT)
    put(c, NGINX_CONF, '/www/server/panel/vhost/nginx/%s.conf' % DOMAIN, 0o644)
    sh(c, 'nginx -t 2>&1 | tail -2')
    sh(c, 'nginx -s reload && echo reloaded')
    time.sleep(1)
    sh(c, 'curl -s -o /dev/null -w "local http://%s -> %%{http_code}\\n" --noproxy "*" -H "Host: %s" http://127.0.0.1/' % (DOMAIN, DOMAIN))
    c.close()
    print('  ✓ nginx 已配置')


def step_ssl():
    print('\n[4/4] 申请 HTTPS 证书')
    c = conn(VPS)
    code, out, _ = sh(c, 'ls /root/.acme.sh/acme.sh 2>/dev/null || which certbot 2>/dev/null || echo NONE', quiet=True)
    tool = out.strip().splitlines()[-1] if out.strip() else 'NONE'
    if tool == 'NONE':
        print('  ! 未找到 acme.sh / certbot，尝试安装 acme.sh')
        sh(c, 'curl -sL https://get.acme.sh | sh -s email=admin@palmscm.com 2>&1 | tail -5', timeout=300)
        sh(c, 'ls /root/.acme.sh/acme.sh', quiet=True)
    sh(c, 'mkdir -p /www/wwwroot/%s %s' % (DOMAIN, CERT_DIR), quiet=True)
    sh(c, '/root/.acme.sh/acme.sh --issue -d %s --webroot /www/wwwroot/%s '
          '--server letsencrypt --force 2>&1 | tail -6' % (DOMAIN, DOMAIN), timeout=420)
    # 落到固定路径（acme.sh 签发目录带 _ecc 后缀，不能写死）
    code, out, err = sh(c, '/root/.acme.sh/acme.sh --install-cert -d %s --ecc '
                           '--key-file %s/privkey.pem '
                           '--fullchain-file %s/fullchain.pem '
                           '--reloadcmd "nginx -s reload" 2>&1 | tail -8'
                           % (DOMAIN, CERT_DIR, CERT_DIR), timeout=180)
    code, out, _ = sh(c, 'ls -la %s/ 2>/dev/null' % CERT_DIR, quiet=True)
    if 'fullchain.pem' not in out:
        print('  ✗ 证书安装失败，保持 HTTP 可用')
        c.close()
        return False
    ssl = """
server
{
    listen 443 ssl;
    http2 on;
    server_name %(d)s;

    ssl_certificate    %(c)s/fullchain.pem;
    ssl_certificate_key %(c)s/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:HIGH:!aNULL:!MD5:!RC4:!DHE;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    location / {
        proxy_pass http://127.0.0.1:%(p)d;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
        proxy_buffering off;
        client_max_body_size 200m;
    }

    access_log /www/wwwlogs/%(d)s.log;
    error_log  /www/wwwlogs/%(d)s.error.log;
}
""" % dict(d=DOMAIN, p=REMOTE_PORT, c=CERT_DIR)
    put(c, ssl, '/www/server/panel/vhost/nginx/%s-ssl.conf' % DOMAIN, 0o644)
    sh(c, 'nginx -t 2>&1 | tail -2')
    sh(c, 'nginx -s reload && echo reloaded')
    time.sleep(1)
    sh(c, 'curl -s -o /dev/null -w "https local -> %%{http_code}\\n" --noproxy "*" --resolve %s:443:127.0.0.1 https://%s/' % (DOMAIN, DOMAIN))
    c.close()
    print('  ✓ HTTPS 已启用')
    return True


if __name__ == '__main__':
    step = (sys.argv[1] if len(sys.argv) > 1 else 'all').lower()
    steps = {'frps': step_frps, 'frpc': step_frpc, 'nginx': step_nginx, 'ssl': step_ssl}
    if step == 'all':
        for k in ('frps', 'frpc', 'nginx', 'ssl'):
            steps[k]()
    elif step in steps:
        steps[step]()
    else:
        print('unknown step: %s (frps|frpc|nginx|ssl|all)' % step)
        sys.exit(1)
