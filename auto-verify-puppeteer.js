/**
 * 图片验证码自动验证工具（Puppeteer版本）
 * 功能：
 * 1. 自动打开验证码页面
 * 2. 自动识别目标位置
 * 3. 模拟真实滑块移动
 * 4. 验证成功后自动刷新继续验证
 * 5. 支持循环验证和单次验证
 */

const puppeteer = require('puppeteer');
const path = require('path');
const http = require('http');
const fs = require('fs');

class CaptchaAutoVerifier {
    constructor(options = {}) {
        this.browser = null;
        this.page = null;
        this.isRunning = false;
        this.config = {
            headless: options.headless !== undefined ? options.headless : false,
            slowMo: options.slowMo || 10,
            defaultViewport: options.defaultViewport || { width: 1280, height: 800 },
            animationDuration: options.animationDuration || 1500,
            refreshDelay: options.refreshDelay || 2000,
            maxAttempts: options.maxAttempts || -1,
            tolerance: options.tolerance || 10
        };
        this.stats = {
            totalAttempts: 0,
            successCount: 0,
            failCount: 0
        };
    }

    async start() {
        console.log('========================================');
        console.log('  图片验证码自动验证工具');
        console.log('========================================');
        console.log('');

        const server = await this.startLocalServer();
        console.log(`🌐 本地服务器已启动: http://localhost:3000`);

        console.log('🚀 启动浏览器...');
        this.browser = await puppeteer.launch({
            headless: this.config.headless,
            slowMo: this.config.slowMo,
            defaultViewport: this.config.defaultViewport,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });

        this.page = await this.browser.newPage();
        
        this.page.on('console', msg => {
            console.log(`[浏览器] ${msg.text()}`);
        });

        console.log('📍 打开验证码页面...');
        await this.page.goto('http://localhost:3000', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        this.isRunning = true;
        await this.runVerificationLoop();
    }

    async startLocalServer() {
        return new Promise((resolve) => {
            const server = http.createServer((req, res) => {
                let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
                
                const extname = path.extname(filePath);
                const contentTypes = {
                    '.html': 'text/html',
                    '.js': 'text/javascript',
                    '.css': 'text/css',
                    '.json': 'application/json'
                };
                
                const contentType = contentTypes[extname] || 'application/octet-stream';

                fs.readFile(filePath, (error, content) => {
                    if (error) {
                        res.writeHead(404);
                        res.end('File Not Found');
                    } else {
                        res.writeHead(200, { 'Content-Type': contentType });
                        res.end(content, 'utf-8');
                    }
                });
            });

            server.listen(3000, () => {
                resolve(server);
            });
        });
    }

    async runVerificationLoop() {
        while (this.isRunning) {
            if (this.config.maxAttempts > 0 && this.stats.totalAttempts >= this.config.maxAttempts) {
                console.log('');
                console.log('========================================');
                console.log('  达到最大尝试次数，停止验证');
                this.printStats();
                console.log('========================================');
                break;
            }

            await this.performVerification();

            if (this.isRunning) {
                console.log(`⏱️  等待 ${this.config.refreshDelay / 1000} 秒后刷新...`);
                await this.delay(this.config.refreshDelay);
                await this.refreshCaptcha();
            }
        }
    }

    async performVerification() {
        this.stats.totalAttempts++;
        console.log('');
        console.log('----------------------------------------');
        console.log(`📊 第 ${this.stats.totalAttempts} 次验证`);
        console.log('----------------------------------------');

        try {
            const targetPosition = await this.getTargetPosition();
            if (targetPosition === null) {
                console.log('❌ 无法获取目标位置');
                this.stats.failCount++;
                return;
            }

            console.log(`📍 目标位置: ${targetPosition}px`);

            const success = await this.simulateSliderMove(targetPosition);

            if (success) {
                console.log('✅ 验证成功！');
                this.stats.successCount++;
            } else {
                console.log('❌ 验证失败');
                this.stats.failCount++;
            }

            this.printStats();

        } catch (error) {
            console.log(`❌ 验证出错: ${error.message}`);
            this.stats.failCount++;
        }
    }

    async getTargetPosition() {
        await this.page.waitForSelector('.verify-mask', { timeout: 5000 });
        
        return await this.page.evaluate(() => {
            if (typeof window.autoVerifyAPI !== 'undefined') {
                return window.autoVerifyAPI.getTargetPosition();
            }
            
            const mask = document.querySelector('.verify-mask');
            if (mask) {
                return parseInt(mask.style.left) || 0;
            }
            
            return null;
        });
    }

    async simulateSliderMove(targetPosition) {
        console.log('🎯 开始模拟滑块移动...');

        const sliderButton = await this.page.$('.slider-button');
        if (!sliderButton) {
            throw new Error('未找到滑块元素');
        }

        const box = await sliderButton.boundingBox();
        if (!box) {
            throw new Error('无法获取滑块位置');
        }

        const startX = box.x + box.width / 2;
        const startY = box.y + box.height / 2;
        
        const targetX = startX + targetPosition;

        await this.page.mouse.move(startX, startY);
        await this.page.mouse.down();

        const steps = this.generateEasedPath(0, targetPosition, this.config.animationDuration);
        
        for (const step of steps) {
            const currentX = startX + step.position;
            await this.page.mouse.move(currentX, startY);
            await this.delay(step.delay);
        }

        await this.page.mouse.up();

        console.log('⏳ 等待验证结果...');
        await this.delay(800);

        return await this.checkVerificationResult();
    }

    generateEasedPath(start, end, duration) {
        const steps = [];
        const totalSteps = Math.ceil(duration / 16);
        const distance = end - start;

        for (let i = 0; i <= totalSteps; i++) {
            const progress = i / totalSteps;
            const easedProgress = this.easeInOutQuad(progress);
            const position = start + distance * easedProgress;
            
            steps.push({
                position: position,
                delay: 16
            });
        }

        return steps;
    }

    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    async checkVerificationResult() {
        return await this.page.evaluate(() => {
            if (typeof window.autoVerifyAPI !== 'undefined') {
                return window.autoVerifyAPI.isVerified();
            }
            
            const message = document.querySelector('.message');
            const sliderText = document.querySelector('.slider-text');
            
            if (message && message.textContent.includes('成功')) {
                return true;
            }
            
            if (sliderText && sliderText.textContent.includes('成功')) {
                return true;
            }
            
            return false;
        });
    }

    async refreshCaptcha() {
        console.log('🔄 刷新验证码...');
        
        const refreshButton = await this.page.$('.refresh-button');
        if (refreshButton) {
            await refreshButton.click();
        } else {
            await this.page.reload({ waitUntil: 'networkidle2' });
        }

        await this.delay(500);
        await this.page.waitForSelector('.verify-mask', { timeout: 10000 });
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    printStats() {
        console.log('');
        console.log('📊 统计信息:');
        console.log(`   总尝试次数: ${this.stats.totalAttempts}`);
        console.log(`   成功次数: ${this.stats.successCount}`);
        console.log(`   失败次数: ${this.stats.failCount}`);
        if (this.stats.totalAttempts > 0) {
            const successRate = ((this.stats.successCount / this.stats.totalAttempts) * 100).toFixed(1);
            console.log(`   成功率: ${successRate}%`);
        }
    }

    async stop() {
        this.isRunning = false;
        if (this.browser) {
            console.log('🛑 关闭浏览器...');
            await this.browser.close();
        }
        console.log('✅ 已停止自动验证');
        this.printStats();
    }
}

async function main() {
    const verifier = new CaptchaAutoVerifier({
        headless: false,
        slowMo: 5,
        animationDuration: 1200,
        refreshDelay: 2000,
        maxAttempts: -1
    });

    try {
        await verifier.start();
    } catch (error) {
        console.error('❌ 错误:', error.message);
        await verifier.stop();
        process.exit(1);
    }

    process.on('SIGINT', async () => {
        console.log('');
        console.log('⏹️  收到停止信号...');
        await verifier.stop();
        process.exit(0);
    });
}

if (require.main === module) {
    main();
}

module.exports = CaptchaAutoVerifier;
