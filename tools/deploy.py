"""把源码通过 SFTP 推到 fnOS，并远程 docker build + compose up。
★ 记忆教训：paramiko 5.0 的 put() 不接受 mode 参数，必须 put 之后显式 sftp.chmod()
★ fnOS 的 /vol1 是 trimacl 卷，权限位不可信但卷内读写正常
用法: python tools/deploy.py [--build-only]
"""
import os
import sys
import paramiko

try:
    from _secrets import NAS_HOST, NAS_USER, NAS_PWD
except ImportError:
    NAS_HOST = os.environ.get('XD_NAS_HOST', '')
    NAS_USER = os.environ.get('XD_NAS_USER', '')
    NAS_PWD = os.environ.get('XD_NAS_PWD', '')

HOST, USER, PWD = NAS_HOST, NAS_USER, NAS_PWD
REMOTE = '/vol1/1000/PATH/apps/xdxp'
LOCAL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

INCLUDE_DIRS = ['server', 'public']
INCLUDE_FILES = ['package.json', 'Dockerfile', 'docker-compose.yml', '.dockerignore']
SKIP = {'.DS_Store', '__pycache__'}


def main():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, USER, PWD, timeout=25)
    sftp = c.open_sftp()

    def rcmd(cmd, timeout=900):
        print('$ ' + cmd)
        i, o, e = c.exec_command(cmd, timeout=timeout)
        out = o.read().decode('utf-8', 'replace')
        err = e.read().decode('utf-8', 'replace')
        code = o.channel.recv_exit_status()
        if out.strip():
            print(out.rstrip())
        if err.strip():
            print('[stderr] ' + err.rstrip())
        print('[exit %d]' % code)
        return code

    try:
        sftp.stat(REMOTE)
    except IOError:
        parts = REMOTE.strip('/').split('/')
        cur = ''
        for p in parts:
            cur += '/' + p
            try:
                sftp.stat(cur)
            except IOError:
                sftp.mkdir(cur)
                sftp.chmod(cur, 0o755)

    uploaded = 0
    for d in INCLUDE_DIRS:
        for root, dirs, files in os.walk(os.path.join(LOCAL, d)):
            dirs[:] = [x for x in dirs if x not in SKIP]
            rel = os.path.relpath(root, LOCAL).replace('\\', '/')
            rp = REMOTE + '/' + rel
            try:
                sftp.stat(rp)
            except IOError:
                sftp.mkdir(rp)
                sftp.chmod(rp, 0o755)
            for f in files:
                if f in SKIP:
                    continue
                lp = os.path.join(root, f)
                rfp = rp + '/' + f
                sftp.put(lp, rfp)
                sftp.chmod(rfp, 0o755 if f.endswith('.sh') else 0o644)
                uploaded += 1
    for f in INCLUDE_FILES:
        lp = os.path.join(LOCAL, f)
        if os.path.exists(lp):
            sftp.put(lp, REMOTE + '/' + f)
            sftp.chmod(REMOTE + '/' + f, 0o644)
            uploaded += 1
    print('已上传 %d 个文件' % uploaded)
    sftp.close()

    rcmd('mkdir -p /vol1/1000/PATH/data/xdxp && chmod 777 /vol1/1000/PATH/data/xdxp')
    code = rcmd('cd %s && docker build -t xdxp:1.0.0 .' % REMOTE, timeout=900)
    if code != 0:
        print('构建失败，终止')
        c.close()
        sys.exit(1)
    if '--build-only' not in sys.argv:
        rcmd('cd %s && docker compose up -d --force-recreate' % REMOTE)
        rcmd('sleep 6; docker ps --filter name=xdxp --format "{{.Names}} {{.Status}} {{.Ports}}"')
        rcmd('curl -s --noproxy "*" http://127.0.0.1:3020/api/projects | head -c 400')
    c.close()


if __name__ == '__main__':
    main()
