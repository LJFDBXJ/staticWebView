const WHITELIST = {
	'https://api.example.com/allowed': '1',
	'lyra-wv-rpc://rpc/render/getEmbedWebViewEnv': '1',
	'/^https:\\/\\/cdn\\.jsdelivr\\.net\\/.*/': 'regex'
}

// 检查URL是否在白名单中
function isUrlAllowed(url) {
	const patterns = Object.keys(WHITELIST);
	for (let i = 0; i < patterns.length; i++) {
		const pattern = patterns[i];
		const isRegexPattern = WHITELIST[pattern] === 'regex';

		if (isRegexPattern || (pattern.startsWith('/') && pattern.endsWith('/'))) {
			// 正则表达式模式
			const regexPattern = isRegexPattern ? pattern : pattern.slice(1, -1);
			const regex = new RegExp(regexPattern);
			if (regex.test(url)) {
				return true;
			}
		} else {
			// 精确匹配或路径前缀匹配
			if (url === pattern || url.startsWith(pattern)) {
				return true;
			}
		}
	}
	return false;
}
// 拦截fetch请求
const originalFetch = window.fetch;
window.fetch = async function(input, init) {
	const url = typeof input === 'string' ? input : input.url;
	// 请求拦截 - 权限检查
	if (!isUrlAllowed(url)) {
		console.warn('[请求拦截] 接口不在允许列表中:', url);
		return new Response(JSON.stringify({
			code: 403,
			message: '请求被拦截: 接口未授权'
		}), {
			status: 403,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	}
	console.log('[请求放行]', url);
	return originalFetch(input, init);
};

// 拦截XMLHttpRequest
const originalXhrOpen = XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
	// 保存URL用于后续检查
	this._requestUrl = url;
	// 保存原始的send方法
	const originalSend = this.send;
	// 重写send方法进行权限检查
	this.send = function(data){
		if (!isUrlAllowed(this._requestUrl)) {
			console.warn('[请求拦截] 接口不在允许列表中:', this._requestUrl);
			// 模拟返回拦截响应
			this.status = 403;
			this.statusText = 'Forbidden';
			this.responseText = JSON.stringify({
				code: 403,
				message: '请求被拦截: 接口未授权'
			});
			// 触发状态变更事件
			if (this.onreadystatechange) this.onreadystatechange();
			if (this.onload) this.onload();
			return;
		}

		console.log('[请求放行]', this._requestUrl);
		originalSend.call(this, data);
	};
	return originalXhrOpen.call(this, method, url, async, user, password);
};
