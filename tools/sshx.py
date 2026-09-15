"""通用 SSH 批量执行工具（独立于 fnOS 的 ssh.py）。

用法:
  python tools/sshx.py <host> <user> <pwd> "cmd1" "cmd2" ...
  python tools/sshx.py <host> <user> <pwd> --k <密钥路径> "cmd1"
"""
import sys

HOST, USER, PWD = sys.argv[1], sys.argv[2], sys.argv[3]
rest = sys.argv[4:]
KEY = None
if rest and rest[0] == '--k':
    KEY = rest[1]
    rest = rest[2:]
CMDS = rest


def main():
    import paramiko
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    kw = dict(timeout=30, banner_timeout=30, allow_agent=False, look_for_keys=False)
    if KEY:
        kw['key_filename'] = KEY
    else:
        kw['password'] = PWD
    c.connect(HOST, 22, USER, **kw)
    for cmd in CMDS:
        i, o, e = c.exec_command(cmd, timeout=120)
        out = o.read().decode('utf-8', 'replace')
        err = e.read().decode('utf-8', 'replace')
        code = o.channel.recv_exit_status()
        print('$ ' + cmd)
        if out.strip():
            print(out.rstrip())
        if err.strip():
            print('[stderr] ' + err.rstrip())
        print('[exit %d]' % code)
        print('-' * 50)
    c.close()


if __name__ == '__main__':
    try:
        main()
    except Exception as ex:
        print('SSH FAILED: %s: %s' % (type(ex).__name__, ex))
        sys.exit(1)
