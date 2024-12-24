class UIController {
    static init() {
        // 初始化背景图片
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
            const backgroundUrl = chatContainer.dataset.background;
            if (backgroundUrl) {
                this.setBackground(backgroundUrl);
            }
        }
    }

    static setBackground(imageUrl) {
        const chatContainer = document.querySelector('.chat-container');
        if (chatContainer) {
            chatContainer.style.backgroundImage = `url('${imageUrl}')`;
        }
    }

    static updateBackgroundOpacity(opacity) {
        const chatContainer = document.querySelector('.chat-container::before');
        if (chatContainer) {
            chatContainer.style.background = `rgba(255, 255, 255, ${opacity})`;
        }
    }
}

// 页面加载完成后初始化UI
document.addEventListener('DOMContentLoaded', () => {
    UIController.init();
}); 