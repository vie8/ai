// 导入游戏系统
import gameSystem from './game-systems.js';
import { chatApp } from './chat.js';

class RandomEventSystem {
    constructor() {
        this.baseEventProbability = 0.2;
        this.maxProbability = 0.8;
        this.probabilityIncrease = 0.05;
        this.currentProbability = this.baseEventProbability;
        this.lastEventTime = 0;
        this.minIntervalTime = 50000;
        this.playerActions = new Set();
        this.inputCount = 0;
        this.hasTriggeredFirstEvent = false;
        console.log('RandomEventSystem initialized');
    }

    async handleUserInput(input) {
        this.inputCount++;
        console.log('---调试信息---');
        console.log(`当前输入: ${input}`);
        console.log(`输入次数: ${this.inputCount}`);
        console.log(`是否已触发首次事件: ${this.hasTriggeredFirstEvent}`);
        
        try {
            await this.analyzeUserAction(input);
        } catch (error) {
            console.error('处理用户输入时出错:', error);
        }
    }

    async analyzeUserAction(input) {
        console.log('分析用户输入:', input);
        const decisionKeywords = {
            '购买': 'purchase',
            '买': 'purchase',
            '卖': 'sell',
            '出售': 'sell',
            '招募': 'recruit',
            '雇佣': 'recruit',
            '投资': 'invest',
            '加入': 'join',
            '接受': 'accept',
            '同意': 'accept',
            '选择': 'choose',
            '拜访': 'visit',
            '探索': 'explore'
        };

        let action = 'general';
        for (const [keyword, actionType] of Object.entries(decisionKeywords)) {
            if (input.includes(keyword)) {
                action = actionType;
                this.playerActions.add(action);
                break;
            }
        }

        console.log(`当前行为类型: ${action}`);

        // 在第四次输入后触发首次随机事件
        if (this.inputCount === 4 && !this.hasTriggeredFirstEvent) {
            console.log('尝试触发首次随机事件');
            this.hasTriggeredFirstEvent = true;
            try {
                // 构建游戏状态对象
                const gameState = {
                    money: gameSystem.money || 0,
                    reputation: gameSystem.reputation || 0,
                    playerAction: action,
                    context: input
                };
                
                console.log('发送的游戏状态:', gameState);
                
                const eventData = await this.generateRandomEvent(gameState);
                console.log('收到随机事件数据:', eventData);
                
                if (eventData && eventData.type === 'random_event') {
                    this.showEventModal(eventData);
                    console.log('首次随机事件触发成功');
                }
            } catch (error) {
                console.error('首次随机事件触发失败:', error);
            }
            return;
        }

        // 之后的输入使用概率触发
        if (this.hasTriggeredFirstEvent) {
            const gameState = {
                money: gameSystem.money,
                reputation: gameSystem.reputation,
                days: gameSystem.days,
                playerAction: action,
                context: input
            };
            await this.checkForContextualEvent(gameState);
        }
    }

    async generateRandomEvent(gameState) {
        try {
            console.log('Sending game state to generate random event:', gameState);
            const response = await fetch('http://localhost:8000/random-event', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    money: gameState.money,
                    reputation: gameState.reputation,
                    playerAction: gameState.playerAction,
                    context: gameState.context
                })
            });

            const responseText = await response.text();
            console.log('Raw response from server:', responseText);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}, response: ${responseText}`);
            }

            try {
                const data = JSON.parse(responseText);
                return data;
            } catch (error) {
                console.error('Error parsing JSON response:', error);
                console.error('Response text:', responseText);
                throw error;
            }
        } catch (error) {
            console.error('Error generating random event:', error);
            throw error;
        }
    }

    showEventModal(eventData) {
        console.log('显示事件模态框:', eventData);

        // 先移除可能存在的旧模态框
        const existingModal = document.querySelector('.event-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // 创建模态框容器
        const modalContainer = document.createElement('div');
        modalContainer.className = 'event-modal';
        modalContainer.style.position = 'fixed';
        modalContainer.style.top = '0';
        modalContainer.style.left = '0';
        modalContainer.style.width = '100%';
        modalContainer.style.height = '100%';
        modalContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
        modalContainer.style.display = 'flex';
        modalContainer.style.justifyContent = 'center';
        modalContainer.style.alignItems = 'center';
        modalContainer.style.zIndex = '1000';

        // 创建模态框内容
        const modalContent = document.createElement('div');
        modalContent.className = 'event-content';
        modalContent.style.backgroundColor = 'white';
        modalContent.style.padding = '20px';
        modalContent.style.borderRadius = '10px';
        modalContent.style.maxWidth = '80%';
        modalContent.style.width = '300px';
        modalContent.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';

        // 设置模态框内容
        modalContent.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #2c3e50; text-align: center;">⚡ ${eventData.title}</h3>
            <p style="margin-bottom: 20px;">${eventData.description}</p>
            <div class="event-input" style="margin-top: 20px;">
                <input type="text" 
                       class="event-response-input" 
                       placeholder="你打算怎么做？"
                       style="width: 100%; 
                              padding: 8px; 
                              border: 1px solid #ddd; 
                              border-radius: 5px; 
                              margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; gap: 10px;">
                    <button class="submit-btn" 
                            style="flex: 1; 
                                   padding: 8px; 
                                   border: none; 
                                   border-radius: 5px; 
                                   background: #27ae60; 
                                   color: white; 
                                   cursor: pointer;">
                        确认决定
                    </button>
                    <button class="close-btn" 
                            style="flex: 1; 
                                   padding: 8px; 
                                   border: none; 
                                   border-radius: 5px; 
                                   background: #e74c3c; 
                                   color: white; 
                                   cursor: pointer;">
                        关闭
                    </button>
                </div>
            </div>
        `;

        modalContainer.appendChild(modalContent);
        document.body.appendChild(modalContainer);

        // 添加按钮事件监听
        const submitBtn = modalContent.querySelector('.submit-btn');
        const closeBtn = modalContent.querySelector('.close-btn');
        const input = modalContent.querySelector('.event-response-input');

        submitBtn.addEventListener('click', () => {
            const userResponse = input.value.trim();
            if (userResponse) {
                this.handleEventResponse(eventData, userResponse);
                modalContainer.remove();
            } else {
                input.style.borderColor = '#e74c3c';
            }
        });

        closeBtn.addEventListener('click', () => {
            modalContainer.remove();
        });

        // 添加回车键提交功能
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                submitBtn.click();
            }
        });
    }

    async handleEventResponse(eventData, userResponse) {
        try {
            console.log('处理用户对事件的响应:', eventData, userResponse);
            
            // 构建事件上下文
            const eventContext = {
                title: eventData.title,
                description: eventData.description,
                userResponse: userResponse,
                currentMoney: gameSystem.money,
                currentReputation: gameSystem.reputation
            };

            // 将事件响应传递给ChatApp处理
            chatApp.handleEventResponse(eventContext);

        } catch (error) {
            console.error('处理事件响应时出错:', error);
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message system-message';
            messageDiv.textContent = '处理响应时出错，请重试。';
            messageDiv.style.color = '#e74c3c';
            document.getElementById('messageContainer').appendChild(messageDiv);
        }
    }

    async checkForContextualEvent(gameState) {
        const timeSinceLastEvent = Date.now() - this.lastEventTime;
        
        if (timeSinceLastEvent < this.minIntervalTime) {
            console.log('距离上次事件时间太短，跳过检查');
            return;
        }

        const roll = Math.random();
        console.log(`当前概率: ${this.currentProbability}, 掷骰结果: ${roll}`);

        if (roll <= this.currentProbability) {
            try {
                const eventData = await this.generateRandomEvent(gameState);
                if (eventData && eventData.type === 'random_event') {
                    this.showEventModal(eventData);
                    this.lastEventTime = Date.now();
                    this.currentProbability = this.baseEventProbability;
                }
            } catch (error) {
                console.error('生成随机事件失败:', error);
            }
        } else {
            this.currentProbability = Math.min(
                this.currentProbability + this.probabilityIncrease,
                this.maxProbability
            );
        }
    }
}

// 创建单例实例
const randomEventSystem = new RandomEventSystem();
console.log('RandomEventSystem instance created');
export { randomEventSystem }; 