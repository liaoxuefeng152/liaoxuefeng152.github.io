/**
 * ==========================================
 *  拉克力跨境 - AI客服小部件 v2.0
 *  扣子(Coze) Agent + SSE流式 + 智能转人工
 * ==========================================
 */
(function () {
  'use strict';

  // ==================== 配置 ====================
  const CONFIG = {
    // 品牌
    botName: '拉克力AI客服',
    botAvatar: '🧠',
    welcomeMsg: '您好！我是拉克力的AI客服助手 ✨<br><br>我可以帮您解答：<br>• 海外GEO优化服务<br>• 域途GEO产品功能<br>• AI外链挖掘<br>• 龙掌柜智能运营<br>• TikTok跨境培训<br><br>请问有什么可以帮您的？',
    placeholder: '输入您的问题，Enter 发送...',
    autoOpenDelay: 5000,

    // Coze API
    apiEndpoint: '/api/chat',
    apiToken: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjEwMDFjY2EzLTllNjktNGJkYS1hYWNhLThlYTEwMzQ4ODdmMCJ9.eyJpc3MiOiJodHRwczovL2FwaS5jb3plLmNuIiwiYXVkIjpbInJ0T3hOTXNEZ2JReWZUUXZJY3h3U1I5NHViakVzQUplIl0sImV4cCI6ODIxMDI2Njg3Njc5OSwiaWF0IjoxNzgzNzYwNzc0LCJzdWIiOiJzcGlmZmU6Ly9hcGkuY296ZS5jbi93b3JrbG9hZF9pZGVudGl0eS9pZDo3NjYxMTUxMTMwOTI3MjM1MTI2Iiwic3JjIjoiaW5ib3VuZF9hdXRoX2FjY2Vzc190b2tlbl9pZDo3NjYxMTk0MTg4OTcyNjIxODc2In0.JrDuIgyIsQAuj4SWkgtm70O4STOW9CmTlTGhkLiCP50XSGwKi44KOmaN6SwaJNapx3CtBusHG4EHU3Kwj0ekwO__IUfVITmgSjnPY_kqyypk4GBPooVg6cKqA_X5F_ZfFuD2mx5UHOzZh-N_Vrp-NGsrc5YF2LWqdp4Kp0Hm_TSrn8Ziay8p4kcUSJbUUxdSYuldR2iFBFPnBd68mJp2vkZlC1sWprowys3FLF1eO203qigU5lkVpWlia46axSiiXlnCon0sTPfQP84GWzIDASjFldzaBVw2cLsOepWe5aa-nG2As0n5Ag_cV8vYpExzss6p8bPas1EHZuW04zWqCg',
    projectId: '7661131730040078355',

    // 快捷回复
    quickReplies: [
      '域途GEO是什么？',
      '如何提升海外AI搜索排名？',
      '龙掌柜能做什么？',
      'TikTok培训有哪些课程？',
      '你们的服务怎么收费？',
    ],

    // 智能转人工 - 这些关键词出现时自动弹出联系方式
    transferKeywords: [
      '报价', '多少钱', '价格', '费用', '收费',
      '合作', '商务', '合同', '签约',
      '方案', '定制', '试用', '演示', 'demo',
      '人工', '转人工', '加微信', '微信', '电话',
      '咨询', '联系', '面谈',
    ],
    // 转人工名片内容
    transferCard: {
      title: '📞 转接人工顾问',
      body: '我是<strong>廖雪峰</strong>，拉克力跨境创始人。很高兴为您提供1对1咨询服务！',
      contactLines: [
        '📞 <strong>13715191472</strong>（微信同号）',
        '📧 contact@lakeli.top',
      ],
    },
  };

  // ==================== 状态 ====================
  let isOpen = false;
  let messages = [];
  let isTyping = false;
  let transferTriggered = false;    // 本次会话是否已触发转人工
  let chatWindow = null;
  let chatBubble = null;
  let messagesEl = null;
  let inputEl = null;
  let sendBtn = null;
  let quickEl = null;
  let abortController = null;       // 用于取消流式请求
  let sessionKeyClosed = 'lakeli_chat_closed';
  let sessionKeyId = 'lakeli_session_id';

  // ==================== Session 管理 ====================
  function getSessionId() {
    let sid = sessionStorage.getItem(sessionKeyId);
    if (!sid) {
      sid = 'web_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem(sessionKeyId, sid);
    }
    return sid;
  }

  // ==================== 智能转人工检测 ====================
  function checkTransferIntent(text) {
    if (transferTriggered) return false;
    const lower = text.toLowerCase();
    return CONFIG.transferKeywords.some(function (kw) {
      return lower.indexOf(kw) !== -1;
    });
  }

  // ==================== CSS 注入 ====================
  const css = `
    /* ---------- 聊天气泡 ---------- */
    #lakeli-chat-bubble {
      position: fixed; bottom: 24px; right: 24px;
      width: 56px; height: 56px; border-radius: 50%;
      background: linear-gradient(135deg, #6366F1, #8B5CF6);
      box-shadow: 0 0 24px rgba(99,102,241,0.5), 0 4px 16px rgba(0,0,0,0.5);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      font-size: 24px; z-index: 99998;
      transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), box-shadow 0.3s;
      animation: lakeli-bubble-pulse 2.5s ease-in-out infinite;
      user-select: none; -webkit-tap-highlight-color: transparent;
    }
    #lakeli-chat-bubble:hover { transform: scale(1.1); box-shadow: 0 0 36px rgba(99,102,241,0.7), 0 8px 24px rgba(0,0,0,0.6); }
    #lakeli-chat-bubble:active { transform: scale(0.95); }
    @keyframes lakeli-bubble-pulse {
      0%,100%{ box-shadow: 0 0 24px rgba(99,102,241,0.5), 0 4px 16px rgba(0,0,0,0.5); }
      50%{ box-shadow: 0 0 36px rgba(99,102,241,0.8), 0 0 48px rgba(139,92,246,0.3), 0 8px 20px rgba(0,0,0,0.6); }
    }
    #lakeli-chat-bubble.hidden { transform: scale(0); opacity: 0; pointer-events: none; }

    /* ---------- 聊天窗口 ---------- */
    #lakeli-chat-window {
      position: fixed; bottom: 96px; right: 24px;
      width: 380px; max-width: calc(100vw - 32px);
      height: 520px; max-height: calc(100vh - 120px);
      background: rgba(15,21,53,0.98); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(99,102,241,0.3); border-radius: 16px;
      box-shadow: 0 0 60px rgba(99,102,241,0.15), 0 20px 48px rgba(0,0,0,0.6);
      display: flex; flex-direction: column; z-index: 99999;
      transform-origin: bottom right;
      transition: transform 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.3s ease;
      overflow: hidden;
    }
    #lakeli-chat-window.closed { transform: scale(0); opacity: 0; pointer-events: none; }
    #lakeli-chat-window.opening { animation: lakeli-chat-open 0.35s cubic-bezier(0.4,0,0.2,1); }
    @keyframes lakeli-chat-open { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }

    /* ---------- Header ---------- */
    #lakeli-chat-window .chat-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 18px; background: rgba(99,102,241,0.08);
      border-bottom: 1px solid rgba(99,102,241,0.15); flex-shrink: 0;
    }
    .chat-header .header-left { display: flex; align-items: center; gap: 10px; }
    .chat-header .bot-avatar {
      width: 36px; height: 36px; border-radius: 50%;
      background: linear-gradient(135deg, #6366F1, #8B5CF6);
      display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;
    }
    .chat-header .bot-info h4 { font-size: 15px; font-weight: 600; color: #F1F5F9; margin: 0; line-height: 1.2; }
    .chat-header .bot-info .status { font-size: 11px; color: #10B981; display: flex; align-items: center; gap: 4px; margin-top: 2px; }
    .chat-header .bot-info .status .dot {
      width: 6px; height: 6px; border-radius: 50%; background: #10B981;
      animation: lakeli-dot-pulse 2s ease-in-out infinite;
    }
    @keyframes lakeli-dot-pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    .chat-header .header-actions { display: flex; gap: 6px; }
    .chat-header .header-btn {
      width: 28px; height: 28px; border-radius: 8px; border: none;
      background: rgba(255,255,255,0.06); color: #94A3B8;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      font-size: 13px; transition: all 0.2s; flex-shrink: 0;
    }
    .chat-header .header-btn:hover { background: rgba(255,255,255,0.12); color: #F1F5F9; }
    .chat-header .header-btn.transfer-btn { color: #FBBF24; }
    .chat-header .header-btn.transfer-btn:hover { background: rgba(251,191,36,0.15); }

    /* ---------- 消息区域 ---------- */
    #lakeli-chat-window .chat-messages {
      flex: 1; overflow-y: auto; padding: 16px 14px 8px;
      display: flex; flex-direction: column; gap: 10px; scroll-behavior: smooth;
    }
    #lakeli-chat-window .chat-messages::-webkit-scrollbar { width: 4px; }
    #lakeli-chat-window .chat-messages::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.2); border-radius: 2px; }

    .chat-msg { display: flex; gap: 8px; max-width: 90%; animation: lakeli-msg-in 0.3s ease; }
    @keyframes lakeli-msg-in { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    .chat-msg.bot { align-self: flex-start; }
    .chat-msg.user { align-self: flex-end; flex-direction: row-reverse; }
    .chat-msg .msg-avatar {
      width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center; font-size: 14px;
    }
    .chat-msg.bot .msg-avatar { background: rgba(99,102,241,0.15); }
    .chat-msg.user .msg-avatar { background: rgba(139,92,246,0.2); }
    .chat-msg .msg-bubble {
      padding: 10px 14px; border-radius: 14px; font-size: 13.5px; line-height: 1.65; word-break: break-word;
    }
    .chat-msg.bot .msg-bubble {
      background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.15);
      border-top-left-radius: 4px; color: #E2E8F0;
    }
    .chat-msg.user .msg-bubble {
      background: linear-gradient(135deg, #6366F1, #7C3AED); border-top-right-radius: 4px; color: #FFF;
    }
    /* 流式打字中的消息 - 末尾闪烁光标 */
    .chat-msg.bot.streaming .msg-bubble::after {
      content: '▍'; animation: lakeli-cursor 0.8s step-end infinite;
    }
    @keyframes lakeli-cursor { 0%,100%{opacity:1} 50%{opacity:0} }

    /* ---------- 转人工名片 ---------- */
    .transfer-card {
      align-self: flex-start; max-width: 90%;
      margin: 4px 0; animation: lakeli-msg-in 0.3s ease;
    }
    .transfer-card-inner {
      background: linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1));
      border: 1px solid rgba(251,191,36,0.4); border-radius: 14px; padding: 14px 16px;
    }
    .transfer-card-inner .tc-title {
      font-size: 13px; font-weight: 600; color: #FBBF24; margin-bottom: 8px;
    }
    .transfer-card-inner .tc-body {
      font-size: 12.5px; color: #E2E8F0; line-height: 1.6; margin-bottom: 10px;
    }
    .transfer-card-inner .tc-contact {
      font-size: 12px; color: #94A3B8; line-height: 1.8;
    }
    .transfer-card-inner .tc-note {
      margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(251,191,36,0.15);
      font-size: 11px; color: #64748B;
    }

    /* ---------- 快速回复 ---------- */
    .chat-quick-replies { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 6px 6px; }
    .chat-quick-reply {
      font-size: 12px; padding: 6px 12px; border-radius: 16px;
      border: 1px solid rgba(99,102,241,0.25); background: rgba(99,102,241,0.06);
      color: #C7D2FE; cursor: pointer; transition: all 0.2s; white-space: nowrap;
      user-select: none; -webkit-tap-highlight-color: transparent;
    }
    .chat-quick-reply:hover { background: rgba(99,102,241,0.2); border-color: rgba(99,102,241,0.5); color: #E0E7FF; }

    /* 正在输入 */
    .chat-typing { display: flex; align-items: center; gap: 8px; padding: 0 0 0 4px; }
    .chat-typing .typing-dots {
      display: flex; gap: 4px; padding: 10px 14px;
      background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.15);
      border-radius: 14px; border-top-left-radius: 4px;
    }
    .chat-typing .typing-dots span {
      width: 6px; height: 6px; border-radius: 50%; background: #818CF8;
      animation: lakeli-typing-dot 1.4s ease-in-out infinite;
    }
    .chat-typing .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .chat-typing .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes lakeli-typing-dot {
      0%,60%,100%{ opacity:0.3; transform:translateY(0) }
      30%{ opacity:1; transform:translateY(-3px) }
    }

    /* ---------- 输入区域 ---------- */
    #lakeli-chat-window .chat-input-area {
      padding: 10px 14px 14px; border-top: 1px solid rgba(99,102,241,0.12);
      display: flex; gap: 8px; align-items: center; flex-shrink: 0;
    }
    .chat-input-area input {
      flex: 1; height: 42px; border-radius: 22px;
      border: 1px solid rgba(99,102,241,0.2); background: rgba(255,255,255,0.04);
      color: #F1F5F9; padding: 0 16px; font-size: 13.5px; font-family: inherit;
      outline: none; transition: border-color 0.2s, background 0.2s;
    }
    .chat-input-area input::placeholder { color: #64748B; }
    .chat-input-area input:focus { border-color: rgba(99,102,241,0.5); background: rgba(255,255,255,0.08); }
    .chat-input-area .send-btn {
      width: 42px; height: 42px; border-radius: 50%; border: none;
      background: linear-gradient(135deg, #6366F1, #8B5CF6); color: #FFF;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      font-size: 16px; flex-shrink: 0; transition: transform 0.2s, box-shadow 0.2s;
    }
    .chat-input-area .send-btn:hover { transform: scale(1.05); box-shadow: 0 0 16px rgba(99,102,241,0.5); }
    .chat-input-area .send-btn:active { transform: scale(0.95); }
    .chat-input-area .send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }

    /* ---------- 移动端 ---------- */
    @media (max-width: 480px) {
      #lakeli-chat-window { bottom: 0; right: 0; width: 100%; max-width: 100%; height: 100%; max-height: 100%; border-radius: 0; border: none; }
      #lakeli-chat-window .chat-header { padding: 16px 14px; }
      #lakeli-chat-bubble { bottom: 16px; right: 16px; }
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
          <button class="header-btn transfer-btn" id="lakeli-chat-transfer" title="转人工">📞</button>
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

    messages.forEach(function (msg, idx) {
      if (msg.type === 'transfer_card') {
        // 转人工名片
        const card = document.createElement('div');
        card.className = 'transfer-card';
        card.innerHTML = `
          <div class="transfer-card-inner">
            <div class="tc-title">${CONFIG.transferCard.title}</div>
            <div class="tc-body">${CONFIG.transferCard.body}</div>
            <div class="tc-contact">${CONFIG.transferCard.contactLines.join('<br>')}</div>
            <div class="tc-note">💡 以上是您的专属顾问，AI将继续为您解答其他问题</div>
          </div>
        `;
        messagesEl.appendChild(card);
        return;
      }

      const div = document.createElement('div');
      div.className = 'chat-msg ' + msg.role + (msg.streaming ? ' streaming' : '');
      div.setAttribute('data-msg-idx', idx);
      div.innerHTML =
        '<div class="msg-avatar">' + (msg.role === 'bot' ? CONFIG.botAvatar : '👤') + '</div>' +
        '<div class="msg-bubble">' + msg.content + '</div>';
      messagesEl.appendChild(div);
    });

    // 正在输入指示器（仅当还没有 streaming 消息时）
    if (isTyping) {
      const hasStreaming = messages.some(function (m) { return m.streaming; });
      if (!hasStreaming) {
        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-typing';
        typingDiv.innerHTML =
          '<div class="msg-avatar" style="width:28px;height:28px;border-radius:50%;background:rgba(99,102,241,0.15);display:flex;align-items:center;justify-content:center;font-size:14px">' +
          CONFIG.botAvatar + '</div>' +
          '<div class="typing-dots"><span></span><span></span><span></span></div>';
        messagesEl.appendChild(typingDiv);
      }
    }

    scrollToBottom();
  }

  function scrollToBottom() {
    if (!messagesEl) return;
    requestAnimationFrame(function () {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  // 局部更新流式消息（不重绘全部，性能更好）
  function updateStreamingMessage(idx, content) {
    const el = messagesEl && messagesEl.querySelector('[data-msg-idx="' + idx + '"]');
    if (el) {
      el.querySelector('.msg-bubble').innerHTML = content;
      scrollToBottom();
    } else {
      // fallback: 全量渲染
      renderMessages();
    }
  }

  // ==================== 快速回复 ====================
  function renderQuickReplies() {
    if (!quickEl) return;
    quickEl.innerHTML = '';
    CONFIG.quickReplies.forEach(function (text) {
      const chip = document.createElement('span');
      chip.className = 'chat-quick-reply';
      chip.textContent = text;
      chip.addEventListener('click', function () {
        sendMessage(text);
        clearQuickReplies();
      });
      quickEl.appendChild(chip);
    });
  }

  function clearQuickReplies() {
    if (quickEl) quickEl.innerHTML = '';
  }

  // ==================== 扣子 API 流式调用 ====================
  async function callCozeAPI(userMessage) {
    const sessionId = getSessionId();

    const body = {
      content: {
        query: {
          prompt: [
            {
              type: 'text',
              content: { text: userMessage },
            },
          ],
        },
      },
      type: 'query',
      session_id: sessionId,
      project_id: CONFIG.projectId,
    };

    abortController = new AbortController();

    const resp = await fetch(CONFIG.apiEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + CONFIG.apiToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: abortController.signal,
    });

    if (!resp.ok) {
      throw new Error('API 请求失败 HTTP ' + resp.status);
    }

    return resp;
  }

  // ==================== SSE 流式解析 ====================
  async function parseSSEStream(response, msgIdx) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // 按行分割 SSE
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留未完成行

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // SSE data 行
        if (line.startsWith('data:')) {
          const jsonStr = line.substring(5).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const data = JSON.parse(jsonStr);

            // 提取文本内容 - 适配多种响应格式
            let text = null;

            // 格式1: { type: "answer", content: { answer: "xxx" } }  (Coze格式)
            if (data.type === 'answer' && data.content) {
              if (typeof data.content === 'string') {
                text = data.content;
              } else if (data.content && data.content.answer) {
                text = data.content.answer;
              }
            }
            // 格式2: { type: "output", content: {...} }
            else if (data.type === 'output' && data.content) {
              text = typeof data.content === 'string' ? data.content : data.content.text || data.content.answer || '';
            }
            // 格式3: { delta: { content: "text" } }
            else if (data.delta && data.delta.content) {
              text = data.delta.content;
            }
            // 格式4: { content: "text" }
            else if (typeof data.content === 'string') {
              text = data.content;
            }
            // 格式5: { message: { content: "text" } }
            else if (data.message && data.message.content) {
              text = data.message.content;
            }
            // 格式6: 裸字符串 (done/error event)
            else if (data.type === 'done' || data.type === 'end' || data.type === 'complete') {
              continue; // 流结束，忽略
            }

            if (text) {
              // 追加到消息内容
              messages[msgIdx].content += text;
              updateStreamingMessage(msgIdx, messages[msgIdx].content);
            }
          } catch (e) {
            // 非 JSON 行，忽略
          }
        }
      }
    }
  }

  // ==================== 发送消息 ====================
  async function sendMessage(text) {
    if (!text || !text.trim()) return;
    text = text.trim();
    if (isTyping) return;

    // 取消上一次请求
    if (abortController) {
      abortController.abort();
      abortController = null;
    }

    // 清除快速回复
    clearQuickReplies();

    // 添加用户消息
    messages.push({ role: 'user', content: text });
    renderMessages();

    // 清空输入
    if (inputEl) inputEl.value = '';

    // 智能转人工检测 - 检查用户消息
    if (checkTransferIntent(text)) {
      transferTriggered = true;
      // 发送后插入转人工名片
      setTimeout(function () {
        messages.push({ type: 'transfer_card' });
        renderMessages();
      }, 600);
    }

    // 显示打字状态
    isTyping = true;
    renderMessages();

    try {
      const response = await callCozeAPI(text);

      // 添加空的 bot 消息，流式填充
      const msgIdx = messages.length;
      messages.push({ role: 'bot', content: '', streaming: true });
      renderMessages();

      // 流式读取
      await parseSSEStream(response, msgIdx);

      // 流式完成
      messages[msgIdx].streaming = false;

      // 检查 AI 回复中是否触发转人工
      const botReply = messages[msgIdx].content;
      if (checkTransferIntent(botReply)) {
        transferTriggered = true;
        messages.push({ type: 'transfer_card' });
      }

    } catch (err) {
      console.error('[LakeliChat] API 错误:', err);

      const errMsg = err && err.name === 'AbortError' ? '请求已取消' :
                       (err && err.message && err.message.includes('Failed to fetch')) ? '网络连接失败（可能是CORS或网络问题）' :
                       '抱歉，服务暂时不可用，请稍后再试。';

      // 找到或创建 bot 消息展示错误
      const streamingMsg = messages.find(function (m) { return m.streaming; });
      if (streamingMsg) {
        streamingMsg.streaming = false;
        if (!streamingMsg.content) {
          streamingMsg.content = errMsg;
        }
      } else {
        messages.push({
          role: 'bot',
          content: '抱歉，服务暂时不可用，请稍后再试。<br><br>您可以直接联系我们：<br>📞 13715191472（微信同号）<br>📧 contact@lakeli.top',
        });
      }
    }

    isTyping = false;
    renderMessages();
  }

  // ==================== 手动转人工 ====================
  function triggerTransfer() {
    if (transferTriggered) return;
    transferTriggered = true;
    messages.push({ type: 'transfer_card' });
    renderMessages();
  }

  // ==================== 打开/关闭 ====================
  function openChat() {
    if (isOpen) return;
    isOpen = true;
    chatWindow.classList.remove('closed');
    chatWindow.classList.add('opening');

    if (messages.length === 0) {
      messages.push({ role: 'bot', content: CONFIG.welcomeMsg });
      renderQuickReplies();
    }
    renderMessages();

    setTimeout(function () {
      if (inputEl) inputEl.focus();
    }, 400);

    sessionStorage.removeItem(sessionKeyClosed);
  }

  function closeChat() {
    if (!isOpen) return;
    isOpen = false;
    chatWindow.classList.add('closed');
    chatWindow.classList.remove('opening');
    sessionStorage.setItem(sessionKeyClosed, '1');
  }

  function toggleChat() {
    if (isOpen) { closeChat(); } else { openChat(); }
  }

  // ==================== 事件绑定 ====================
  function bindEvents() {
    document.getElementById('lakeli-chat-transfer').addEventListener('click', function (e) {
      e.stopPropagation();
      triggerTransfer();
    });

    document.getElementById('lakeli-chat-close').addEventListener('click', function (e) {
      e.stopPropagation();
      closeChat();
    });

    sendBtn = document.getElementById('lakeli-chat-send');
    sendBtn.addEventListener('click', function () {
      if (isTyping) return;
      sendMessage(inputEl.value);
    });

    inputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage(inputEl.value);
      }
    });

    inputEl.addEventListener('input', function () {
      sendBtn.disabled = !inputEl.value.trim() || isTyping;
      sendBtn.style.opacity = sendBtn.disabled ? '0.4' : '1';
    });
  }

  // ==================== 初始化 ====================
  function init() {
    injectStyles();
    chatBubble = buildBubble();
    chatWindow = buildWindow();
    messagesEl = document.getElementById('lakeli-chat-messages');
    inputEl = document.getElementById('lakeli-chat-input');
    quickEl = document.getElementById('lakeli-chat-quick');
    bindEvents();

    var closed = sessionStorage.getItem(sessionKeyClosed);
    if (!closed) {
      setTimeout(function () {
        openChat();
      }, CONFIG.autoOpenDelay);
    }
  }

  // ==================== 公开 API ====================
  window.LakeliChat = {
    open: function () { openChat(); },
    close: function () { closeChat(); },
    toggle: function () { toggleChat(); },
    transfer: function () { triggerTransfer(); },
    getConfig: function () { return CONFIG; },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
