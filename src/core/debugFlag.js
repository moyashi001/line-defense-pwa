// デバッグモード判定: URL に ?debug=1 を付けると有効(公開版でも使える)
export const DEBUG = new URLSearchParams(location.search).get('debug') === '1';
