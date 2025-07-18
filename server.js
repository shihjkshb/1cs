const express = require('express');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

// 增强CORS配置
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST']
}));

app.use(express.json());

// 超时设置（毫秒）
const TIMEOUT = 30000;
// 重试次数
const MAX_RETRIES = 2;

// 支持的小说网站配置（增强版）
const SOURCES = {
    qidian: {
        name: '起点中文网',
        searchUrl: 'https://www.qidian.com/search?kw=',
        baseUrl: 'https://www.qidian.com',
        selectors: {
            list: '.book-img-text li',
            title: 'h4 a',
            author: '.author a.name',
            cover: '.book-img-box img',
            desc: '.intro',
            link: 'h4 a'
        },
        // 新增防爬配置
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    },
    biquge: {
        name: '笔趣阁',
        searchUrl: 'http://www.biquge.com.tw/search.php?keyword=',
        baseUrl: 'http://www.biquge.com.tw',
        selectors: {
            list: '#main .result-list .result-item',
            title: '.result-game-item-title a',
            author: '.result-game-item-info p:eq(0) span:eq(1)',
            cover: '.result-game-item-pic img',
            desc: '.result-game-item-desc',
            link: '.result-game-item-title a'
        },
        // 新增延迟配置
        delay: 2000
    }
};

// 获取浏览器实例（单例模式）
let browserInstance;
async function getBrowser() {
    if (!browserInstance) {
        browserInstance = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage'
            ]
        });
    }
    return browserInstance;
}

// 增强的爬取函数
async function crawlWithRetry(url, options = {}, retryCount = 0) {
    try {
        const browser = await getBrowser();
        const page = await browser.newPage();
        
        // 设置请求头
        await page.setExtraHTTPHeaders(options.headers || {});
        
        // 设置视口
        await page.setViewport({ width: 1280, height: 800 });
        
        // 设置请求超时
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: TIMEOUT
        });

        // 自定义延迟
        if (options.delay) {
            await page.waitForTimeout(options.delay);
        }

        const html = await page.content();
        await page.close();
        
        return html;
    } catch (error) {
        if (retryCount < MAX_RETRIES) {
            console.log(`第${retryCount + 1}次重试...`);
            return crawlWithRetry(url, options, retryCount + 1);
        }
        throw error;
    }
}

// 获取小说搜索结果（增强版）
app.get('/api/search', async (req, res) => {
    try {
        const { keyword, source } = req.query;
        
        if (!SOURCES[source]) {
            return res.status(400).json({ 
                error: '不支持的源站',
                supportedSources: Object.keys(SOURCES) 
            });
        }

        const sourceConfig = SOURCES[source];
        const searchUrl = `${sourceConfig.searchUrl}${encodeURIComponent(keyword)}`;
        
        const html = await crawlWithRetry(searchUrl, sourceConfig);
        const $ = cheerio.load(html);
        
        const results = [];
        $(sourceConfig.selectors.list).each((i, el) => {
            const title = $(el).find(sourceConfig.selectors.title).text().trim();
            const author = $(el).find(sourceConfig.selectors.author).text().trim();
            const cover = $(el).find(sourceConfig.selectors.cover).attr('src');
            const desc = $(el).find(sourceConfig.selectors.desc).text().trim();
            const link = $(el).find(sourceConfig.selectors.link).attr('href');

            if (title) {
                results.push({
                    title,
                    author,
                    cover: cover ? (cover.startsWith('http') ? cover : `${sourceConfig.baseUrl}${cover}`) : '',
                    desc,
                    link: link ? (link.startsWith('http') ? link : `${sourceConfig.baseUrl}${link}`) : '',
                    source: sourceConfig.name
                });
            }
        });

        res.json(results.length > 0 ? results : { message: '未找到相关小说，请尝试更换关键词' });
    } catch (error) {
        console.error('搜索错误:', error);
        res.status(500).json({ 
            error: '搜索失败',
            detail: error.message,
            solution: '请检查：1.网络连接 2.目标网站是否可访问 3.稍后重试'
        });
    }
});

// 其他API保持不变...

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log('可用源站:', Object.keys(SOURCES).join(', '));
});

// 优雅关闭
process.on('SIGINT', async () => {
    if (browserInstance) {
        await browserInstance.close();
    }
    process.exit();
});