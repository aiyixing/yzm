/**
 * 图片验证码自动验证脚本（浏览器控制台版本）
 * 使用方法：
 * 1. 打开验证码页面
 * 2. 按F12打开开发者工具
 * 3. 切换到Console标签
 * 4. 复制此脚本并粘贴运行
 */

(function() {
    'use strict';

    console.log('========================================');
    console.log('  图片验证码自动验证工具已启动');
    console.log('========================================');

    const AutoVerify = {
        isRunning: false,
        refreshInterval: null,
        config: {
            checkInterval: 500,
            refreshDelay: 2000,
            animationDuration: 1000
        },

        start: function() {
            if (this.isRunning) {
                console.log('⚠️  自动验证已在运行中');
                return;
            }
            
            this.isRunning = true;
            console.log('✅ 自动验证已启动');
            this.verify();
        },

        stop: function() {
            this.isRunning = false;
            if (this.refreshInterval) {
                clearTimeout(this.refreshInterval);
                this.refreshInterval = null;
            }
            console.log('⏹️  自动验证已停止');
        },

        verify: function() {
            if (!this.isRunning) return;

            console.log('🔍 正在获取目标位置...');
            
            const targetPosition = this.getTargetPosition();
            if (targetPosition === null) {
                console.log('⚠️  无法获取目标位置，等待页面加载...');
                setTimeout(() => this.verify(), this.config.checkInterval);
                return;
            }

            console.log(`📍 目标位置: ${targetPosition}px`);
            this.simulateSliderMove(targetPosition);
        },

        getTargetPosition: function() {
            if (typeof window.autoVerifyAPI !== 'undefined') {
                return window.autoVerifyAPI.getTargetPosition();
            }
            
            const mask = document.querySelector('.verify-mask');
            if (mask) {
                const left = parseInt(mask.style.left) || 0;
                return left;
            }
            
            return null;
        },

        simulateSliderMove: function(targetPosition) {
            console.log('🎯 开始模拟滑块移动...');
            
            const sliderButton = document.querySelector('.slider-button');
            const sliderFill = document.querySelector('.slider-fill');
            const puzzle = document.querySelector('.verify-puzzle');
            
            if (!sliderButton) {
                console.log('❌ 未找到滑块元素');
                this.retry();
                return;
            }

            const startLeft = 23;
            const targetLeft = targetPosition + 23;
            const startTime = Date.now();
            const duration = this.config.animationDuration;

            const animate = () => {
                const elapsed = Date.now() - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const easedProgress = this.easeInOutQuad(progress);
                
                const currentLeft = startLeft + (targetLeft - startLeft) * easedProgress;
                const currentPosition = Math.floor(currentLeft - 23);

                if (sliderFill) {
                    sliderFill.style.width = currentLeft + 'px';
                }
                sliderButton.style.left = currentLeft + 'px';
                
                if (puzzle) {
                    puzzle.style.left = currentPosition + 'px';
                }

                if (progress < 1) {
                    requestAnimationFrame(animate);
                } else {
                    console.log('✅ 滑块移动完成，触发验证...');
                    this.triggerVerify(targetPosition);
                }
            };

            animate();
        },

        triggerVerify: function(targetPosition) {
            if (typeof window.autoVerifyAPI !== 'undefined') {
                window.autoVerifyAPI.verify();
            } else {
                const mouseUpEvent = new MouseEvent('mouseup', {
                    bubbles: true,
                    cancelable: true
                });
                document.dispatchEvent(mouseUpEvent);
            }

            setTimeout(() => {
                this.checkResult();
            }, 500);
        },

        checkResult: function() {
            const message = document.querySelector('.message');
            const sliderText = document.querySelector('.slider-text');
            
            let isSuccess = false;
            
            if (typeof window.autoVerifyAPI !== 'undefined') {
                isSuccess = window.autoVerifyAPI.isVerified();
            }
            
            if (message && message.textContent.includes('成功')) {
                isSuccess = true;
            }
            
            if (sliderText && sliderText.textContent.includes('成功')) {
                isSuccess = true;
            }

            if (isSuccess) {
                console.log('🎉 验证成功！');
                this.onSuccess();
            } else {
                console.log('❌ 验证失败，准备重试...');
                this.retry();
            }
        },

        onSuccess: function() {
            if (!this.isRunning) return;
            
            console.log(`⏱️  ${this.config.refreshDelay / 1000}秒后自动刷新并重新验证...`);
            
            this.refreshInterval = setTimeout(() => {
                if (!this.isRunning) return;
                
                console.log('🔄 刷新验证码...');
                
                if (typeof window.autoVerifyAPI !== 'undefined') {
                    window.autoVerifyAPI.refresh();
                } else {
                    const refreshButton = document.querySelector('.refresh-button');
                    if (refreshButton) {
                        refreshButton.click();
                    } else {
                        location.reload();
                    }
                }
                
                setTimeout(() => {
                    this.verify();
                }, 1000);
            }, this.config.refreshDelay);
        },

        retry: function() {
            if (!this.isRunning) return;
            
            console.log('🔄 重新尝试验证...');
            setTimeout(() => {
                this.verify();
            }, 1000);
        },

        easeInOutQuad: function(t) {
            return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        },

        status: function() {
            console.log('========================================');
            console.log('  自动验证状态');
            console.log('========================================');
            console.log('运行状态:', this.isRunning ? '运行中' : '已停止');
            console.log('目标位置:', this.getTargetPosition());
            
            if (typeof window.autoVerifyAPI !== 'undefined') {
                console.log('当前位置:', window.autoVerifyAPI.getCurrentPosition());
                console.log('是否验证成功:', window.autoVerifyAPI.isVerified());
            }
            console.log('========================================');
        }
    };

    window.AutoVerify = AutoVerify;

    console.log('');
    console.log('📋 可用命令:');
    console.log('  AutoVerify.start()  - 启动自动验证');
    console.log('  AutoVerify.stop()   - 停止自动验证');
    console.log('  AutoVerify.status() - 查看当前状态');
    console.log('');
    console.log('💡 输入 AutoVerify.start() 开始自动验证');
    console.log('========================================');

})();
