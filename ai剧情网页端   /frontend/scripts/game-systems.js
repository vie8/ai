// 导入随机事件系统
import { randomEventSystem } from './random-events.js';

class GameSystems {
    constructor() {
        // 从 localStorage 加载游戏状态，如果没有则使用默认值
        const savedState = localStorage.getItem('gameState');
        if (savedState) {
            const state = JSON.parse(savedState);
            this.money = state.money;
            this.reputation = state.reputation;
            this.days = state.days;
            this.gameStarted = state.gameStarted || false;
        } else {
            this.money = 100;
            this.reputation = 0;
            this.days = 60;
            this.gameStarted = false;
        }
        this.init();
    }

    init() {
        // 初始化定时器，每隔一定时间减少天数
        setInterval(() => {
            if (this.days > 0) {
                this.days--;
                this.updateUI();
                this.saveState();
            }
        }, 60000);

        // 添加页面关闭或刷新前的保存
        window.addEventListener('beforeunload', () => {
            this.saveState();
        });
    }

    // 保存游戏状态到 localStorage
    saveState() {
        const gameState = {
            money: this.money,
            reputation: this.reputation,
            days: this.days,
            gameStarted: this.gameStarted
        };
        localStorage.setItem('gameState', JSON.stringify(gameState));
    }

    updateUI() {
        const stats = document.querySelector('.game-stats');
        if (stats) {
            stats.innerHTML = `
                <span class="stat-item">💰 ${this.money}</span>
                <span class="stat-item">⭐ ${this.reputation}</span>
                <span class="stat-item">📅 ${this.days}天</span>
            `;
        }
    }

    // 金钱系统方法
    changeMoney(amount) {
        this.money += amount;
        this.updateUI();
        this.saveState();
        return this.money;
    }

    // 声望系统方法
    changeReputation(amount) {
        this.reputation += amount;
        this.updateUI();
        this.saveState();
        return this.reputation;
    }

    // 获取游戏状态
    getGameState() {
        return {
            money: this.money,
            reputation: this.reputation,
            days: this.days,
            gameStarted: this.gameStarted
        };
    }

    // 重置游戏
    async resetGame() {
        try {
            // 清除本地存储
            localStorage.removeItem('gameState');
            localStorage.removeItem('chatHistory');
            
            // 重置后端会话
            const response = await fetch('http://localhost:8000/reset-game', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: chatApp.sessionId
                })
            });

            if (!response.ok) {
                throw new Error('Failed to reset game on server');
            }

            // 重置游戏状态
            this.money = 100;
            this.reputation = 0;
            this.days = 60;
            this.gameStarted = false;
            this.updateUI();

            // 清空聊天界面
            const messageContainer = document.getElementById('messageContainer');
            messageContainer.innerHTML = '';

            // 生成新的会话ID
            chatApp.resetSession();

            // 显示开场白
            setTimeout(() => {
                const welcomeMessage = `欢迎来到15世纪的佛罗伦萨！
你现在有100金币在口袋里，站在这座繁华城市的街头。
你可以：
1. 成为一名商人，经营店铺，努力成为富甲一方的豪绅
2. 当一名雇佣兵，提供护卫服务，争取成为光荣的骑士
3. 加入地下帮派，赚取黑金，以反抗贵族
4. 成为一名寻宝者，探索充满宝藏的危机之境
4. 或者...告诉我你想以什么角色开始游戏？`;

                const messageDiv = document.createElement('div');
                messageDiv.className = 'message ai-message';
                messageDiv.textContent = welcomeMessage;
                messageContainer.appendChild(messageDiv);
            }, 1000);

        } catch (error) {
            console.error('Error resetting game:', error);
        }
    }
}

// 创建游戏系统实例
const gameSystem = new GameSystems();
export default gameSystem; 