# -*- coding: utf-8 -*-
"""
凭据模板（此文件会进入版本库，仅含占位符）。

使用方法：
    1. 复制本文件为 _secrets.py：  cp _secrets.example.py _secrets.py
    2. 在 _secrets.py 中填入真实值。
    3. _secrets.py 已被 .gitignore 排除，不会进入版本库。

若 _secrets.py 缺失，脚本会回退读取以下环境变量：
    XD_NAS_HOST / XD_NAS_USER / XD_NAS_PWD
    XD_VPS_HOST / XD_VPS_USER / XD_VPS_PWD
    XD_FRP_TOKEN / XD_FRPS_WEB_PWD
"""

# --- 内网 fnOS NAS（SSH 部署目标） ---
NAS_HOST = ''   # fnOS SSH 主机（内网 IP）
NAS_USER = ''   # fnOS SSH 账号
NAS_PWD = ''    # fnOS SSH 密码

# --- 阿里云 VPS（frps + nginx 中转） ---
VPS_HOST = ''   # 阿里云 SSH 主机（公网 IP）
VPS_USER = ''   # 阿里云 SSH 账号（通常 root）
VPS_PWD = ''    # 阿里云 SSH 密码

# --- frp 隧道认证 ---
FRP_TOKEN = ''      # frp 隧道认证 token（frps 与 frpc 共用）

# --- frps 管理面板 ---
FRPS_WEB_PWD = ''   # frps webServer 面板密码
