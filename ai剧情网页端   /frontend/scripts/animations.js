class AnimationController {
    static animateElement(element, animation) {
        element.style.animation = animation;
        return new Promise(resolve => {
            element.addEventListener('animationend', () => resolve(), {once: true});
        });
    }

    static fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';
        
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                element.style.transition = `opacity ${duration}ms ease`;
                element.style.opacity = '1';
                setTimeout(resolve, duration);
            });
        });
    }

    static scrollToBottom(element) {
        element.scrollTop = element.scrollHeight;
    }
} 