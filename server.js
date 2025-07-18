const express = require('express');
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 支持的小说网站配置
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
        }
    },
    hongxiu: {
        name: '红袖添香',
        searchUrl: 'https://www.hongxiu.com/search?kw=',
        baseUrl: 'https://www.hongxiu.com',
        selectors: {
            list: '.right-book-list li',
            title: '.book-info h3 a',
            author: '.book-info .author a.name',
            cover: '.book-img img',
            desc: '.book-info .intro',
            link: '.book-info h3 a'
        }
    }
};

// 获取小说搜索结果
app.get('/api/search', async (req, res) => {
    try {
        const { keyword, source } = req.query;
        
        if (!SOURCES[source]) {
            return res.status(400).json({ error: '不支持的源站' });
        }

        const sourceConfig = SOURCES[source];
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        await page.goto(`${sourceConfig.searchUrl}${encodeURIComponent(keyword)}`);
        const html = await page.content();
        await browser.close();

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
                    cover: cover.startsWith('http') ? cover : `${sourceConfig.baseUrl}${cover}`,
                    desc,
                    link: link.startsWith('http') ? link : `${sourceConfig.baseUrl}${link}`,
                    source: sourceConfig.name
                });
            }
        });

        res.json(results);
    } catch (error) {
        console.error('搜索错误:', error);
        res.status(500).json({ error: '搜索失败' });
    }
});

// 获取小说章节内容
app.get('/api/chapters', async (req, res) => {
    try {
        const { url, source } = req.query;
        
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url);
        const html = await page.content();
        await browser.close();

        const $ = cheerio.load(html);
        const chapters = [];

        // 根据不同源站解析章节
        if (source === 'qidian') {
            $('#j-catalogWrap .volume-wrap .cf li').each((i, el) => {
                const title = $(el).find('a').text().trim();
                const link = $(el).find('a').attr('href');
                if (title && link) {
                    chapters.push({
                        title,
                        link: `https:${link}`
                    });
                }
            });
        } else if (source === 'biquge') {
            $('#list dd a').each((i, el) => {
                const title = $(el).text().trim();
                const link = $(el).attr('href');
                if (title && link) {
                    chapters.push({
                        title,
                        link: new URL(link, url).href
                    });
                }
            });
        }

        res.json(chapters);
    } catch (error) {
        console.error('获取章节错误:', error);
        res.status(500).json({ error: '获取章节失败' });
    }
});

// 获取章节内容
app.get('/api/content', async (req, res) => {
    try {
        const { url } = req.query;
        
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(url);
        const content = await page.evaluate(() => {
            // 根据不同网站结构提取内容
            if (window.location.host.includes('qidian')) {
                return document.querySelector('.read-content')?.innerText || '';
            } else if (window.location.host.includes('biquge')) {
                return document.querySelector('#content')?.innerText || '';
            }
            return '';
        });
        await browser.close();

        res.json({ content });
    } catch (error) {
        console.error('获取内容错误:', error);
        res.status(500).json({ error: '获取内容失败' });
    }
});

// 用户收藏功能
let favorites = [];

app.post('/api/favorites', (req, res) => {
    const { novel } = req.body;
    if (!favorites.some(f => f.link === novel.link)) {
        favorites.push(novel);
    }
    res.json(favorites);
});

app.get('/api/favorites', (req, res) => {
    res.json(favorites);
});

app.delete('/api/favorites/:id', (req, res) => {
    const { id } = req.params;
    favorites = favorites.filter((_, index) => index !== parseInt(id));
    res.json(favorites);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});