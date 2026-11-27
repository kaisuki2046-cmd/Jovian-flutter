# 账户设置

## Android 版本更新

`GET /app-updates/android/latest` 供 Android 客户端检查版本，响应不会包含账户资料。账户服务在仓库根目录的 `.env` 读取两个配置。

- `APP_ANDROID_RELEASE_FILE` 指向发布清单，可使用 `.local/android-release.json`。
- `ANDROID_UPDATE_DOWNLOAD_ORIGIN` 是允许的 HTTPS 下载来源。Flutter Android 构建参数使用同一个来源。

清单格式如下。发布时使用正式包名、递增版本号、更新说明和签名包下载地址。

```json
{
  "release": {
    "applicationId": "com.jovian.preview",
    "versionCode": 12,
    "versionName": "1.2.0",
    "notes": ["本次更新内容"],
    "downloadUrl": "https://downloads.example.com/jovian.apk"
  }
}
```

服务每次检查都会读取清单。配置尚未启用或清单内容为 `{"release":null}` 时返回暂无发布。已配置但无法读取或校验时返回 503。替换清单前先准备好对应的下载文件。
