// 导入随机事件系统
import { randomEventSystem } from './random-events.js';

// 在文件开头添加关键词数组
const VIOLENT_KEYWORDS = [
    '打斗',  '打架', '烧', '攻击', '搏斗', '挥舞', '拳头',
    '暴力', '击打', '殴打', '战斗','挥拳','失控' ,'反击','战斗','抗击','冲突','矛盾' 
];

// 添加金钱相关关键词
const MONEY_KEYWORDS = [
    '宝藏', '礼物', '珠宝', '财富', '财宝', 
    '黄金', '钻石', '发财'
];

// 添加打劫相关关键词
const ROBBERY_KEYWORDS = [
    '劫匪', '打劫', '抢夺', '拦截', '土匪', '抢劫'
];

// 在文件开头添加文本预处理函数
function preprocessText(text) {
    return text
        .replace(/[\n\r]+/g, ' ') // 替换所有换行和回车为空格
        .replace(/\s+/g, ' ') // 将多个空格替换为单个空格
        .trim(); // 去除首尾空格
}

class ChatApp {
    constructor() {
        this.messageContainer = document.getElementById('messageContainer');
        this.userInput = document.getElementById('userInput');
        this.sendButton = document.getElementById('sendButton');
        this.sessionId = 'session_' + Date.now();
        this.shouldAutoScroll = true;
        this.lastEventResult = null;
        this.messageCount = 0;
        this.isFirstMessage = true; // 添加标记判断是否是首次消息
        
        // 初始化
        this.init();
        
        // 更新初始游戏状态
        this.updateGameStats('💰金钱：100，⭐声望：0');
    }

    init() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // 添加滚动监听
        this.messageContainer.addEventListener('scroll', () => {
            const threshold = 100; // 距离底部的阈值（像素）
            const distanceFromBottom = this.messageContainer.scrollHeight - 
                                     this.messageContainer.scrollTop - 
                                     this.messageContainer.clientHeight;
            
            this.shouldAutoScroll = distanceFromBottom <= threshold;
        });
    }

    scrollToBottom(smooth = true) {
        if (!this.shouldAutoScroll) return;

        const lastMessage = this.messageContainer.lastElementChild;
        if (lastMessage) {
            lastMessage.scrollIntoView({ 
                behavior: smooth ? 'smooth' : 'auto',
                block: 'end'
            });
        }
    }

    addMessage(type, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}-message`;
        messageDiv.textContent = content;
        this.messageContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    updateLastAIMessage(content) {
        let lastAIMessage = this.messageContainer.querySelector('.ai-message:last-child');
        if (!lastAIMessage) {
            lastAIMessage = document.createElement('div');
            lastAIMessage.className = 'message ai-message';
            this.messageContainer.appendChild(lastAIMessage);
        }
        lastAIMessage.textContent = content;
        this.scrollToBottom(false); // 流式响应时使用即时滚动
    }

    // 新增：解析并更新游戏状态
    updateGameStats(text) {
        // 匹配金钱数值，例如 "💰金钱：650" 或 "金钱：650"
        const moneyMatch = text.match(/[💰]?金钱：(\d+)/);
        if (moneyMatch) {
            const moneyValue = moneyMatch[1];
            document.querySelector('.stat-item:nth-child(1)').textContent = `💰 ${moneyValue}`;
        }

        // 匹配声望数值，例如 "⭐️声望：30" 或 "声望：30"
        const reputationMatch = text.match(/[⭐️]?声(\d+)/);
        if (reputationMatch) {
            const reputationValue = reputationMatch[1];
            document.querySelector('.stat-item:nth-child(2)').textContent = `⭐ ${reputationValue}`;
        }
    }

    async sendMessage() {
        const message = this.userInput.value.trim();
        if (!message) return;

        this.messageCount++; // 恢复消息计数
        this.addMessage('user', message);
        this.userInput.value = '';

        // 在第二条消息后触发卡片特效
        if (this.messageCount === 2) {
            this.triggerCardEffect();
        }

        try {
            const eventContext = this.lastEventResult ? 
                `[系统] 随机事件结果：${this.lastEventResult.message}` +
                `（金钱${this.lastEventResult.effects.money >= 0 ? '+' : ''}${this.lastEventResult.effects.money}，` +
                `声望${this.lastEventResult.effects.reputation >= 0 ? '+' : ''}${this.lastEventResult.effects.reputation}）` : '';

            const response = await fetch('http://localhost:8000/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    message,
                    sessionId: this.sessionId,
                    eventContext: eventContext
                })
            });

            this.lastEventResult = null;

            if (!response.ok) throw new Error('Network response was not ok');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiResponse = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    // 在流式响应结束后，进行一次性的关键词检测
                    this.checkAndTriggerEffects(aiResponse);
                    this.updateGameStats(aiResponse);
                    break;
                }

                const text = decoder.decode(value);
                const lines = text.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(5));
                            if (data.content) {
                                aiResponse += data.content;
                                this.updateLastAIMessage(aiResponse);
                            }
                        } catch (e) {
                            console.error('Error parsing JSON:', e);
                        }
                    }
                }
            }

            await randomEventSystem.handleUserInput(message);

        } catch (error) {
            console.error('Error:', error);
            this.addMessage('system', `发送消息时出错了${error.message}。请重试。`);
            if (error.message === 'Network response was not ok') {
                setTimeout(() => {
                    this.sendMessage();
                }, 2000);
            }
        }
    }

    // 修改检查和触发特效的方法
    checkAndTriggerEffects(text) {
        console.log('开始检查完整响应的关键词...');
        const processedText = preprocessText(text);
        
        // 检查暴力关键词
        const hasViolentContent = VIOLENT_KEYWORDS.some(keyword => {
            const hasKeyword = processedText.includes(keyword);
            if (hasKeyword) {
                console.log('匹配到暴力关键词:', keyword);
            }
            return hasKeyword;
        });
        
        // 检查打劫关键词
        const hasRobberyContent = ROBBERY_KEYWORDS.some(keyword => {
            const hasKeyword = processedText.includes(keyword);
            if (hasKeyword) {
                console.log('匹配到打劫关键词:', keyword);
            }
            return hasKeyword;
        });
        
        // 检查金钱关键词
        const hasMoneyContent = MONEY_KEYWORDS.some(keyword => {
            const hasKeyword = processedText.includes(keyword);
            if (hasKeyword) {
                console.log('匹配到金钱关键词:', keyword);
            }
            return hasKeyword;
        });

        // 按优先级触发特效，但允许同时触发不同类型的特效
        if (hasViolentContent) { // 暴力特效优先级最高
            console.log('触发暴力特效');
            triggerViolentEffect();
        } else if (hasRobberyContent) { // 其次是打劫特效
            console.log('触发打劫特效');
            triggerRobberyEffect();
        }

        // 金钱特效可以与其他特效同时触发
        if (hasMoneyContent) {
            console.log('触发金钱特效');
            triggerMoneyRainEffect();
        }
    }

    // 添加方法用于设置随机事件结果
    setEventResult(result) {
        this.lastEventResult = result;
    }

    // 在ChatApp类中添加新方法
    handleEventResponse(eventContext) {
        // 构建事件响应消息
        const eventResponseMessage = `[系统] 随机事件"${eventContext.title}"发生：
${eventContext.description}
你的决定：${eventContext.userResponse}`;

        // 将事件响应作为用户消息添加到对话中
        this.addMessage('system', eventResponseMessage);
        
        // 触发一次正常的消息发送，让AI响应用户的决定
        this.userInput.value = eventContext.userResponse;
        this.sendMessage();
    }

    // 修改 triggerCardEffect 方法
    triggerCardEffect() {
        // 创建固定定位的遮罩层
        const overlay = document.createElement('div');
        overlay.className = 'card-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;

        // 创建卡片容器
        const cardContainer = document.createElement('div');
        cardContainer.className = 'magic-card-container';
        cardContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            transform: scale(0);
            position: relative;
            z-index: 10000;
            padding: 20px;
            border-radius: 15px;
            animation: glowPulse 4s infinite ease-in-out;
        `;

        // 添加紫光动画样式
        const styleSheet = document.createElement('style');
        styleSheet.textContent = `
            @keyframes glowPulse {
                0% { 
                    box-shadow: 0 0 15px 5px rgba(147, 51, 234, 0.5);
                    transform: translate(0, 0);
                }
                25% { 
                    box-shadow: 0 0 20px 8px rgba(147, 51, 234, 0.6);
                    transform: translate(-5px, 5px);
                }
                50% { 
                    box-shadow: 0 0 25px 10px rgba(147, 51, 234, 0.7);
                    transform: translate(5px, -5px);
                }
                75% { 
                    box-shadow: 0 0 20px 8px rgba(147, 51, 234, 0.6);
                    transform: translate(5px, 5px);
                }
                100% { 
                    box-shadow: 0 0 15px 5px rgba(147, 51, 234, 0.5);
                    transform: translate(0, 0);
                }
            }
        `;
        document.head.appendChild(styleSheet);

        // 修改卡片样式
        const card = document.createElement('div');
        card.className = 'card';
        card.style.cssText = `
            width: 280px;
            height: 400px;
            position: relative;
            cursor: pointer;
            transform-style: preserve-3d;
            transition: transform 0.5s;
            border-radius: 15px;
            overflow: hidden;
            box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
        `;
        
        // 恢复使用图片作为标题
        const titleImg = document.createElement('img');
        titleImg.className = 'title';
        titleImg.src = '/frontend/images/card/title.png';
        titleImg.style.cssText = `
            position: absolute;
            width: 80%;
            left: 10%;
            bottom: 20px;
            z-index: 3;
            transition: transform 0.5s;
            filter: drop-shadow(0 0 5px rgba(147, 51, 234, 0.8));
        `;

        // 修改英雄图片样式
        const heroImg = document.createElement('img');
        heroImg.className = 'hero';
        heroImg.src = '/frontend/images/card/hero.png';
        heroImg.style.cssText = `
            position: absolute;
            width: 100%;
            height: 100%;
            object-fit: cover;
            z-index: 2;
            opacity: 0;
            transition: all 0.5s;
            border-radius: 15px;
            filter: drop-shadow(0 0 10px rgba(147, 51, 234, 0.5));
        `;
        
        const coverImg = document.createElement('img');
        coverImg.className = 'cover';
        coverImg.src = '/frontend/images/card/cover.jpg';
        coverImg.style.cssText = `
            position: absolute;
            width: 100%;
            height: 100%;
            object-fit: cover;
            backface-visibility: hidden;
            transition: transform 0.5s;
            border-radius: 10px;
        `;

        // 修改文字提示部分
        const text = document.createElement('div'); 
        text.innerHTML = '恭喜获得"阿卡纳指引"魔法卡，<br>随着游戏的冒险，<br>你可以获得更加稀有的魔法卡！';
        text.style.cssText = `
            color: #fff;
            font-size: 20px;
            text-align: center;
            margin-top: 20px;
            line-height: 1.5;
            text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
            max-width: 300px;
            padding: 0 10px;
        `;

        // 组装卡片
        card.appendChild(coverImg);
        card.appendChild(heroImg);
        card.appendChild(titleImg);
        cardContainer.appendChild(card);
        cardContainer.appendChild(text);
        overlay.appendChild(cardContainer);

        // 添加到 body
        document.body.appendChild(overlay);

        // 添加点击遮罩层关闭功能
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                cardContainer.style.transform = 'scale(0)';
                setTimeout(() => {
                    overlay.remove();
                }, 500);
            }
        });

        // 修改卡片悬停效果
        card.addEventListener('mouseenter', () => {
            coverImg.style.transform = 'perspective(500px) rotateX(25deg)';
            coverImg.style.boxShadow = '0 35px 0px 10px rgba(0, 0, 0, 0.7)';
            heroImg.style.opacity = '1';
            heroImg.style.transform = 'perspective(500px) translate3d(0,-25px,100px)';
            titleImg.style.transform = 'perspective(500px) translate3d(0,-25px,50px)';
            cardContainer.style.animation = 'none';
            cardContainer.style.transform = 'scale(1.05)';
            cardContainer.style.boxShadow = '0 0 30px 15px rgba(147, 51, 234, 0.8)';
            cardContainer.style.transition = 'all 0.3s ease-out';
        });

        card.addEventListener('mouseleave', () => {
            coverImg.style.transform = 'none';
            coverImg.style.boxShadow = 'none';
            heroImg.style.opacity = '0';
            heroImg.style.transform = 'none';
            titleImg.style.transform = 'none';
            cardContainer.style.animation = 'glowPulse 4s infinite ease-in-out';
            cardContainer.style.transform = 'scale(1)';
            cardContainer.style.boxShadow = '0 0 15px 5px rgba(147, 51, 234, 0.5)';
        });

        // 添加入场动画
        requestAnimationFrame(() => {
            cardContainer.style.transition = 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            cardContainer.style.transform = 'scale(1)';
        });

        // 修改自动关闭时间为 18 秒
        setTimeout(() => {
            cardContainer.style.transform = 'scale(0)';
            setTimeout(() => {
                overlay.remove();
            }, 500);
        }, 18000); // 延长到 18 秒
    }

    // 修改 resetSession 方法
    resetSession() {
        this.sessionId = 'session_' + Date.now();
        this.messageCount = 0;
        this.lastEventResult = null;
        this.isFirstMessage = true; // 重置首次消息标记
        
        // 重置聊天界面，只保留开场白
        this.messageContainer.innerHTML = `
            <div class="message ai-message">
欢迎来到15世纪的佛罗伦萨！ 👋
你站在熙熙攘攘的街头，周围是古老的建筑和忙碌的商贩。你是一个初来乍到的冒险者，需要在这里建立自己的声望和财富。

💰金钱：100，⭐声望：0

你可以：
1. 成为一名商人，经营店铺，努力成为富甲一方的豪绅
2. 当一名雇佣兵，提供护卫服务，争取成为光荣的骑士
3. 加入地下帮派，赚取黑金，以反抗贵族
4. 成为一名寻宝者，探索充满宝藏的危机之境
4. 或者...告诉我你想以什么角色开始游戏？</div>
        `;
        
        // 更新游戏状态
        this.updateGameStats('💰金钱：100，⭐声望：0');
    }
}

// 初始化应用
const chatApp = new ChatApp();
export { chatApp }; 

// 修改关键词检测函数
function checkViolentContent(text) {
    const processedText = preprocessText(text);
    console.log('处理后的文:', processedText); // 添加调试日志
    
    // 检查打劫关键词
    const hasRobberyContent = ROBBERY_KEYWORDS.some(keyword => {
        const hasKeyword = processedText.includes(keyword);
        if (hasKeyword) {
            console.log('匹配到打劫关键词:', keyword); // 添加调试日志
        }
        return hasKeyword;
    });

    if (hasRobberyContent) {
        console.log('检测到打劫关键词，准备触发特效');
        triggerRobberyEffect();
    }
    
    // 原有的暴力关键词检测
    const hasViolentContent = VIOLENT_KEYWORDS.some(keyword => processedText.includes(keyword));
    if (hasViolentContent) {
        console.log('检测到暴力关键词:', processedText);
        triggerShakeEffect();
    }
    
    return hasViolentContent || hasRobberyContent;
}

// 添加抖动特效函数
function triggerShakeEffect() {
    console.log('触发抖动特效');
    const chatContainer = document.querySelector('.chat-container');
    if (!chatContainer) {
        console.error('未找到 chat-container 元素');
        return;
    }
    
    // 创建更剧烈的抖动效果
    gsap.to(chatContainer, {
        x: "random(-20, 20)", // 增加水平抖动范围
        y: "random(-15, 15)", // 增加垂直抖动范围
        duration: 0.08,      // 减小单次抖动时间使动作更快
        repeat: 12,          // 增加重复次数
        yoyo: true,
        ease: "power2.inOut", // 改变缓动函数使动作更有力
        onComplete: () => {
            // 添加余效果
            gsap.to(chatContainer, {
                x: "random(-8, 8)",
                y: "random(-6, 6)",
                duration: 0.2,
                repeat: 3,
                yoyo: true,
                ease: "power1.inOut",
                onComplete: () => {
                    // 最后缓慢回原位
                    gsap.to(chatContainer, {
                        x: 0,
                        y: 0,
                        duration: 0.5,
                        ease: "elastic.out(1, 0.3)" // 添加弹性效果
                    });
                }
            });
        }
    });
}

// 修改金钱关键词检测函数
function checkMoneyContent(text) {
    const processedText = preprocessText(text);
    const hasMoneyContent = MONEY_KEYWORDS.some(keyword => processedText.includes(keyword));
    if (hasMoneyContent) {
        console.log('检测到金钱关键词:', processedText);
    }
    return hasMoneyContent;
}

// 修改金钱雨特效函数
function triggerMoneyRainEffect() {
    console.log('触发金钱雨特效');
    const chatContainer = document.querySelector('.chat-container');
    const chatMessages = document.querySelector('.chat-messages');
    
    // 预创建所有符号素并添加到文档片段中
    const fragment = document.createDocumentFragment();
    const symbols = [];
    const totalSymbols = 50; // 总符号数量
    
    for (let i = 0; i < totalSymbols; i++) {
        const symbol = createMoneySymbol();
        fragment.appendChild(symbol);
        symbols.push(symbol);
    }
    
    // 一次性将所有符号添加到容器
    chatContainer.insertBefore(fragment, chatMessages);
    
    // 获取容器边界
    const containerBounds = chatContainer.getBoundingClientRect();
    const visibleHeight = containerBounds.height;
    
    // 为所有符号设置初始状态和动画
    symbols.forEach((symbol, index) => {
        // 随机起始位置
        const startX = Math.random() * (containerBounds.width - 40);
        const startDelay = (index * 30) % 500; // 减小延迟时间，使效果更密集
        
        // 使用GSAP的时间轴来优化动
        const tl = gsap.timeline({
            defaults: { ease: "power1.in" }
        });
        
        // 设置初始状态 - 确保从容器顶部开始
        gsap.set(symbol, {
            x: startX,
            y: -30, // 从容器顶部稍微上方开始
            rotation: 0,
            scale: 0,
            opacity: 0,
            zIndex: 1000
        });
        
        // 创建入场和下落动画
        tl.to(symbol, {
            opacity: 1,
            scale: 1,
            duration: 0.2,
            delay: startDelay / 1000
        }).to(symbol, {
            y: visibleHeight + 30, // 确保到容器底部
            x: `+=${(Math.random() - 0.5) * 120}`, // 增加水平摆动范围
            rotation: 'random(-360, 360)',
            duration: 1.5 + Math.random(), // 调整下落时间
            ease: "power1.in",
            onComplete: () => {
                symbol.remove();
            }
        }, "-=0.1");
    });
}

// 优化符号创建函数
function createMoneySymbol() {
    const symbol = document.createElement('div');
    symbol.className = 'money-symbol';
    
    // 随机选择符号和大小
    const symbols = ['💰', '💎', '💸', '⭐️', '✨'];
    symbol.textContent = symbols[Math.floor(Math.random() * symbols.length)];
    
    // 随机大小围小以提高性能
    const size = 20 + Math.random() * 12;
    symbol.style.fontSize = `${size}px`;
    
    return symbol;
}

// 添加通用的弹出图片特效函数
function triggerPopupEffect(options) {
    const {
        imagePath,
        text,
        withShake = false // 是否同时触发抖动效果
    } = options;
    
    console.log(`开始触发弹出特效: ${text}`);
    
    // 创建包含图片和文字的容器
    const popupContainer = document.createElement('div');
    popupContainer.className = 'popup-alert';
    popupContainer.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0);
        z-index: 2000;
        text-align: center;
        opacity: 0;
    `;
    
    // 创建图片元素并添加加载错误处理
    const popupImage = document.createElement('img');
    popupImage.src = imagePath;
    popupImage.onerror = () => {
        console.error('图片加载失败:', popupImage.src);
    };
    popupImage.onload = () => {
        console.log('图片加载成功');
    };
    popupImage.style.cssText = `
        width: 150px;
        height: 150px;
        margin-bottom: 10px;
    `;
    
    // 创建文字元素
    const popupText = document.createElement('div');
    popupText.textContent = text;
    popupText.style.cssText = `
        color: #ff0000;
        font-size: 24px;
        font-weight: bold;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
    `;
    
    // 组装元素
    popupContainer.appendChild(popupImage);
    popupContainer.appendChild(popupText);
    
    // 添加到 body 而不是聊天容器，确保全屏显示
    document.body.appendChild(popupContainer);
    
    console.log('特效元素已添加到DOM');
    
    // 如果需要抖动效果，同时触发
    if (withShake) {
        triggerShakeEffect();
    }
    
    // 创建动画
    const tl = gsap.timeline();
    
    // 弹出动画
    tl.to(popupContainer, {
        opacity: 1,
        scale: 1,
        duration: 0.5,
        ease: "back.out(1.7)",
        onStart: () => console.log('开始显示动画'),
        onComplete: () => console.log('显示动画完成')
    })
    // 停留一段时间
    .to(popupContainer, {
        scale: 1.1,
        duration: 2,
        ease: "none",
        onStart: () => console.log('开始停留动画')
    })
    // 消失动画
    .to(popupContainer, {
        opacity: 0,
        scale: 0,
        duration: 0.5,
        ease: "back.in(1.7)",
        onStart: () => console.log('开始消失动画'),
        onComplete: () => {
            console.log('特效完成，移除元素');
            popupContainer.remove();
        }
    });
}

// 修改打劫特效函数
function triggerRobberyEffect() {
    triggerPopupEffect({
        imagePath: '/frontend/images/robbery.png',
        text: '你被打劫了！',
        withShake: true
    });
}

// 修改暴力特效函数
function triggerViolentEffect() {
    triggerPopupEffect({
        imagePath: '/frontend/images/fight.png', // 需要准备一张打斗相关的图片
        text: '发生打斗！',
        withShake: true
    });
} 