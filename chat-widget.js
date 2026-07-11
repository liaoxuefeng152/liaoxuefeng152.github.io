/**
 * ==========================================
 *  拉克力跨境 - AI客服小部件 v1.0
 *  扣子(Coze) Agent 驱动 | API 接口可配置
 * ==========================================
 */
(function () {
  'use strict';

  // ==================== 配置 ====================
  const CONFIG = {
    botName: '拉克力AI客服',
    botAvatar:  '🧠',
    welcomeMsg: '您好！我是拉克力的AI客服助手 ✨<br><br>我可以帮您解答：<br>• 海外GEO优化服务<br>• 域途GEO产品功能<br>• AI外链挖掘<br>• 龙掌柜智能运营<br>• TikTok跨境培训<br><br>请问有什么可以帮您的？',
    placeholder: '输入您的问题，Enter 发送...',
    autoOpenDelay: 5000,       // 5秒后自动弹出
    apiEndpoint: '',           // 留空，等用户提供 API 地址
    apiHandler: null,          // 外部可注入自定义 handler
    quickReplies: [
      '域途GEO是什么？',
      '如何提升海外AI搜索排名？',
      '龙掌柜能做什么？',
      'TikTok培训有哪些课程？',
      '你们的服务怎么收费？',
    ],
  };

  // ==================== 状态 ====================
  let isOpen = false;
  let isMinimized = false;
  let messages = [];
  let isTyping = false;
  let chatWindow = null;
  let chatBubble = null;
  let messagesEl = null;
  let inputEl = null;
  let sessionKey = 'lakeli_chat_closed';

  // ==================== CSS 注入 ====================
  const css = `
    /* ---------- 聊天气泡 ---------- */
    #lakeli-chat-bubble {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366F1, #8B5CF6);
      box-shadow: 0 0 24px rgba(99, 102, 241, 0.5), 0 4px 16px rgba(0,0,0,0.5);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      z-index: 99998;
      transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), box-shadow 0.3s;
      animation: lakeli-bubble-pulse 2.5s ease-in-out infinite;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    #lakeli-chat-bubble:hover {
      transform: scale(1.1);
      box-shadow: 0 0 36px rgba(99, 102, 241, 0.7), 0 8px 24px rgba(0,0,0,0.6);
    }
    #lakeli-chat-bubble:active {
      transform: scale(0.95);
    }
    @keyframes lakeli-bubble-pulse {
      0%, 100% { box-shadow: 0 0 24px rgba(99, 102, 241, 0.5), 0 4px 16px rgba(0,0,0,0.5); }
      50% { box-shadow: 0 0 36px rgba(99, 102, 241, 0.8), 0 0 48px rgba(139, 92, 246, 0.3), 0 8px 20px rgba(0,0,0,0.6); }
    }
    #lakeli-chat-bubble .bubble-icon {
      line-height: 1;
      pointer-events: none;
      transition: transform 0.3s;
    }
    /* 气泡关闭动画 */
    #lakeli-chat-bubble.hidden {
      transform: scale(0);
      opacity: 0;
      pointer-events: none;
    }

    /* ---------- 聊天窗口 ---------- */
    #lakeli-chat-window {
      position: fixed;
      bottom: 96px;
      right: 24px;
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 520px;
      max-height: calc(100vh - 120px);
      background: rgba(15, 21, 53, 0.98);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(99, 102, 241, 0.3);
      border-radius: 16px;
      box-shadow: 0 0 60px rgba(99, 102, 241, 0.15), 0 20px 48px rgba(0,0,0,0.6);
      display: flex;
      flex-direction: column;
      z-index: 99999;
      transform-origin: bottom right;
      transition: transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease;
      overflow: hidden;
    }
    #lakeli-chat-window.closed {
      transform: scale(0);
      opacity: 0;
      pointer-events: none;
    }
    #lakeli-chat-window.opening {
      animation: lakeli-chat-open 0.35s cubic-bezier(0.4,0,0.2,1);
    }
    @keyframes lakeli-chat-open {
      from { transform: scale(0); opacity: 0; }
      to   { transform: scale(1); opacity: 1; }
    }

    /* ---------- 聊天窗口头部 ---------- */
    #lakeli-chat-window .chat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      background: rgba(99, 102, 241, 0.08);
      border-bottom: 1px solid rgba(99, 102, 241, 0.15);
      flex-shrink: 0;
    }
    .chat-header .header-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .chat-header .bot-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366F1, #8B5CF6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      flex-shrink: 0;
    }
    .chat-header .bot-info h4 {
      font-size: 15px;
      font-weight: 600;
      color: #F1F5F9;
      margin: 0;
      line-height: 1.2;
    }
    .chat-header .bot-info .status {
      font-size: 11px;
      color: #10B981;
      display: flex;
      align-items: center;
      gap: 4px;
      line-height: 1;
      margin-top: 2px;
    }
    .chat-header .bot-info .status .dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10B981;
      animation: lakeli-dot-pulse 2s ease-in-out infinite;
    }
    @keyframes lakeli-dot-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    .chat-header .header-actions {
      display: flex;
      gap: 8px;
    }
    .chat-header .header-btn {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      border: none;
      background: rgba(255,255,255,0.06);
      color: #94A3B8;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: all 0.2s;
      flex-shrink: 0;
    }
    .chat-header .header-btn:hover {
      background: rgba(255,255,255,0.12);
      color: #F1F5F9;
    }

    /* ---------- 消息区域 ---------- */
    #lakeli-chat-window .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px 16px 8px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scroll-behavior: smooth;
    }
    #lakeli-chat-window .chat-messages::-webkit-scrollbar {
      width: 4px;
    }
    #lakeli-chat-window .chat-messages::-webkit-scrollbar-thumb {
      background: rgba(99, 102, 241, 0.2);
      border-radius: 2px;
    }

    /* 消息气泡 */
    .chat-msg {
      display: flex;
      gap: 8px;
      max-width: 90%;
      animation: lakeli-msg-in 0.35s ease;
    }
    @keyframes lakeli-msg-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .chat-msg.bot {
      align-self: flex-start;
    }
    .chat-msg.user {
      align-self: flex-end;
      flex-direction: row-reverse;
    }
    .chat-msg .msg-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    }
    .chat-msg.bot .msg-avatar {
      background: rgba(99, 102, 241, 0.15);
    }
    .chat-msg.user .msg-avatar {
      background: rgba(139, 92, 246, 0.2);
    }
    .chat-msg .msg-bubble {
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 13.5px;
      line-height: 1.6;
      word-break: break-word;
    }
    .chat-msg.bot .msg-bubble {
      background: rgba(99, 102, 241, 0.1);
      border: 1px solid rgba(99, 102, 241, 0.15);
      border-top-left-radius: 4px;
      color: #E2E8F0;
    }
    .chat-msg.user .msg-bubble {
      background: linear-gradient(135deg, #6366F1, #7C3AED);
      border-top-right-radius: 4px;
      color: #FFFFFF;
    }

    /* 快速回复 */
    .chat-quick-replies {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 0 8px 8px;
    }
    .chat-quick-reply {
      font-size: 12px;
      padding: 6px 12px;
      border-radius: 16px;
      border: 1px solid rgba(99, 102, 241, 0.25);
      background: rgba(99, 102, 241, 0.06);
      color: #C7D2FE;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;
      user-select: none;
      -webkit-tap-highlight-color: transparent;
    }
    .chat-quick-reply:hover {
      background: rgba(99, 102, 241, 0.2);
      border-color: rgba(99, 102, 241, 0.5);
      color: #E0E7FF;
    }

    /* 正在输入 */
    .chat-typing {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 0 0 4px;
    }
    .chat-typing .typing-dots {
      display: flex;
      gap: 4px;
      padding: 10px 14px;
      background: rgba(99, 102, 241, 0.1);
      border: 1px solid rgba(99, 102, 241, 0.15);
      border-radius: 14px;
      border-top-left-radius: 4px;
    }
    .chat-typing .typing-dots span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #818CF8;
      animation: lakeli-typing-dot 1.4s ease-in-out infinite;
    }
    .chat-typing .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .chat-typing .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes lakeli-typing-dot {
      0%, 60%, 100% { opacity: 0.3; transform: translateY(0); }
      30% { opacity: 1; transform: translateY(-3px); }
    }

    /* ---------- 输入区域 ---------- */
    #lakeli-chat-window .chat-input-area {
      padding: 10px 14px 14px;
      border-top: 1px solid rgba(99, 102, 241, 0.12);
      display: flex;
      gap: 8px;
      align-items: center;
      flex-shrink: 0;
    }
    .chat-input-area input {
      flex: 1;
      height: 42px;
      border-radius: 22px;
      border: 1px solid rgba(99, 102, 241, 0.2);
      background: rgba(255,255,255,0.04);
      color: #F1F5F9;
      padding: 0 16px;
      font-size: 13.5px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.2s, background 0.2s;
    }
    .chat-input-area input::placeholder {
      color: #64748B;
    }
    .chat-input-area input:focus {
      border-color: rgba(99, 102, 241, 0.5);
      background: rgba(255,255,255,0.08);
    }
    .chat-input-area .send-btn {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      border: none;
      background: linear-gradient(135deg, #6366F1, #8B5CF6);
      color: #FFFFFF;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      flex-shrink: 0;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .chat-input-area .send-btn:hover {
      transform: scale(1.05);
      box-shadow: 0 0 16px rgba(99, 102, 241, 0.5);
    }
    .chat-input-area .send-btn:active {
      transform: scale(0.95);
    }
    .chat-input-area .send-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    /* ---------- 移动端适配 ---------- */
    @media (max-width: 480px) {
      #lakeli-chat-window {
        bottom: 0;
        right: 0;
        width: 100%;
        max-width: 100%;
        height: 100%;
        max-height: 100%;
        border-radius: 0;
        border: none;
      }
      #lakeli-chat-window .chat-header {
        padding: 16px;
      }
      #lakeli-chat-bubble {
        bottom: 16px;
        right: 16px;
      }
    }
  `;

  // ==================== DOM 构建 ====================
  function injectStyles() {
    const style = document.createElement('style');
    style.id = 'lakeli-chat-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildBubble() {
    const bubble = document.createElement('div');
    bubble.id = 'lakeli-chat-bubble';
    bubble.innerHTML = '<span class="bubble-icon">💬</span>';
    bubble.addEventListener('click', toggleChat);
    document.body.appendChild(bubble);
    return bubble;
  }

  function buildWindow() {
    const win = document.createElement('div');
    win.id = 'lakeli-chat-window';
    win.classList.add('closed');
    win.innerHTML = `
      <div class="chat-header">
        <div class="header-left">
          <div class="bot-avatar">${CONFIG.botAvatar}</div>
          <div class="bot-info">
            <h4>${CONFIG.botName}</h4>
            <div class="status"><span class="dot"></span>在线</div>
          </div>
        </div>
        <div class="header-actions">
          <button class="header-btn" id="lakeli-chat-close" title="关闭">✕</button>
        </div>
      </div>
      <div class="chat-messages" id="lakeli-chat-messages"></div>
      <div class="chat-quick-replies" id="lakeli-chat-quick"></div>
      <div class="chat-input-area">
        <input type="text" id="lakeli-chat-input" placeholder="${CONFIG.placeholder}" autocomplete="off">
        <button class="send-btn" id="lakeli-chat-send" title="发送">➤</button>
      </div>
    `;
    document.body.appendChild(win);
    return win;
  }

  // ==================== 消息渲染 ====================
  function renderMessages() {
    if (!messagesEl) return;
    messagesEl.innerHTML = '';

    messages.forEach(function (msg) {
      const div = document.createElement('div');
      div.className = 'chat-msg ' + msg.role;
      div.innerHTML =
        '<div class="msg-avatar">' +
        (msg.role === 'bot' ? CONFIG.botAvatar : '👤') +
        '</div>' +
        '<div class="msg-bubble">' + msg.content + '</div>';
      messagesEl.appendChild(div);
    });

    // 正在输入指示器
    if (isTyping) {
      const typingDiv = document.createElement('div');
      typingDiv.className = 'chat-typing';
      typingDiv.innerHTML =
        '<div class="msg-avatar" style="width:28px;height:28px;border-radius:50%;background:rgba(99,102,241,0.15);display:flex;align-items:center;justify-content:center;font-size:14px">' +
        CONFIG.botAvatar +
        '</div>' +
        '<div class="typing-dots"><span></span><span></span><span></span></div>';
      messagesEl.appendChild(typingDiv);
    }

    scrollToBottom();
  }

  function scrollToBottom() {
    if (!messagesEl) return;
    requestAnimationFrame(function () {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  // ==================== 快速回复 ====================
  function renderQuickReplies() {
    const quickEl = document.getElementById('lakeli-chat-quick');
    if (!quickEl) return;
    quickEl.innerHTML = '';
    CONFIG.quickReplies.forEach(function (text) {
      const chip = document.createElement('span');
      chip.className = 'chat-quick-reply';
      chip.textContent = text;
      chip.addEventListener('click', function () {
        sendMessage(text);
        quickEl.remove(); // 发送后隐藏快速回复
      });
      quickEl.appendChild(chip);
    });
  }

  // ==================== 发送消息 ====================
  async function sendMessage(text) {
    if (!text || !text.trim()) return;
    text = text.trim();
    if (isTyping) return;

    // 添加用户消息
    messages.push({ role: 'user', content: text });
    renderMessages();

    // 清空输入
    if (inputEl) inputEl.value = '';

    // 显示打字状态
    isTyping = true;
    renderMessages();

    try {
      let reply;

      // 优先使用外部注入的 apiHandler
      if (typeof CONFIG.apiHandler === 'function') {
        reply = await CONFIG.apiHandler(text);
      } else if (CONFIG.apiEndpoint) {
        // 否则使用 fetch API
        const resp = await fetch(CONFIG.apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text }),
        });
        if (!resp.ok) throw new Error('API 请求失败: ' + resp.status);
        const data = await resp.json();
        reply = data.reply || data.answer || data.content || data.text || '抱歉，我暂时无法回答这个问题。';
      } else {
        // 未配置 API，返回占位回复
        reply = '👋 您好！客服系统正在配置中，请稍后再试。<br><br>您也可以直接联系我们：<br>📞 13715191472（微信同号）<br>📧 contact@lakeli.top';
      }

      messages.push({ role: 'bot', content: reply });
    } catch (err) {
      console.error('[LakeliChat] API 错误:', err);
      messages.push({
        role: 'bot',
        content: '抱歉，服务暂时不可用，请稍后再试。您可以直接联系我们：<br>📞 13715191472（微信同号）<br>📧 contact@lakeli.top',
      });
    }

    isTyping = false;
    renderMessages();
  }

  // ==================== 打开/关闭 ====================
  function openChat() {
    if (isOpen) return;
    isOpen = true;
    chatWindow.classList.remove('closed');
    chatWindow.classList.add('opening');

    // 首次打开渲染欢迎消息
    if (messages.length === 0) {
      messages.push({ role: 'bot', content: CONFIG.welcomeMsg });
      renderQuickReplies();
    }
    renderMessages();

    // 聚焦输入框
    setTimeout(function () {
      if (inputEl) inputEl.focus();
    }, 400);

    // 清除自动弹出标记
    sessionStorage.removeItem(sessionKey);
  }

  function closeChat() {
    if (!isOpen) return;
    isOpen = false;
    chatWindow.classList.add('closed');
    chatWindow.classList.remove('opening');
    sessionStorage.setItem(sessionKey, '1');
  }

  function toggleChat() {
    if (isOpen) {
      closeChat();
    } else {
      openChat();
    }
  }

  // ==================== 事件绑定 ====================
  function bindEvents() {
    // 关闭按钮
    document.getElementById('lakeli-chat-close').addEventListener('click', function (e) {
      e.stopPropagation();
      closeChat();
    });

    // 发送按钮
    document.getElementById('lakeli-chat-send').addEventListener('click', function () {
      if (isTyping) return;
      sendMessage(inputEl.value);
    });

    // Enter 发送
    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(inputEl.value);
      }
    });

    // 发送按钮禁用状态
    inputEl.addEventListener('input', function () {
      var btn = document.getElementById('lakeli-chat-send');
      btn.disabled = !inputEl.value.trim() || isTyping;
      btn.style.opacity = btn.disabled ? '0.4' : '1';
    });
  }

  // ==================== 初始化 ====================
  function init() {
    injectStyles();
    chatBubble = buildBubble();
    chatWindow = buildWindow();
    messagesEl = document.getElementById('lakeli-chat-messages');
    inputEl = document.getElementById('lakeli-chat-input');
    bindEvents();

    // 自动弹出：仅当用户未手动关闭过
    var closed = sessionStorage.getItem(sessionKey);
    if (!closed) {
      setTimeout(function () {
        openChat();
      }, CONFIG.autoOpenDelay);
    }
  }

  // ==================== 公开 API ====================
  window.LakeliChat = {
    /** 设置自定义 API 处理函数 */
    setAPIHandler: function (handler) {
      if (typeof handler === 'function') {
        CONFIG.apiHandler = handler;
      }
    },

    /** 设置 API 端点 URL */
    setAPIEndpoint: function (url) {
      CONFIG.apiEndpoint = url;
    },

    /** 设置快捷回复 */
    setQuickReplies: function (replies) {
      if (Array.isArray(replies)) {
        CONFIG.quickReplies = replies;
      }
    },

    /** 设置欢迎语 */
    setWelcomeMsg: function (msg) {
      CONFIG.welcomeMsg = msg;
    },

    /** 打开聊天窗口 */
    open: function () {
      openChat();
    },

    /** 关闭聊天窗口 */
    close: function () {
      closeChat();
    },

    /** 切换聊天窗口 */
    toggle: function () {
      toggleChat();
    },

    /** 获取配置 */
    getConfig: function () {
      return CONFIG;
    },
  };

  // DOM 就绪后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
