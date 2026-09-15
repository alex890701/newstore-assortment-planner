import paramiko, sys, os

try:
    from _secrets import NAS_HOST, NAS_USER, NAS_PWD
except ImportError:
    NAS_HOST = os.environ.get('XD_NAS_HOST', '')
    NAS_USER = os.environ.get('XD_NAS_USER', '')
    NAS_PWD = os.environ.get('XD_NAS_PWD', '')

HOST, USER, PWD = NAS_HOST, NAS_USER, NAS_PWD
CMDS = sys.argv[1:]


def run():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, USER, PWD, timeout=25)
    for cmd in CMDS:
        i, o, e = c.exec_command(cmd)
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
    run()
