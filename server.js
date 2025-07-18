const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 目标小说网站
const NOVEL_SITE = 'https://www.10000txt.com';

// 搜索小说
app.get('/api/search', async (req, res) => {
  try {
    const { keyword } = req.query;
    
    if (!keyword) {
      return res.status(400).json({ error: '请输入搜索关键词' });
    }

    // 直接爬取目标网站
    const searchUrl = `${NOVEL_SITE}/s?q=${encodeURIComponent(keyword)}`;
    const { data } = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(data);
    const results = [];

    // 解析搜索结果
    $('.book-list li').each((i, el) => {
      const title = $(el).find('h4 a').text().trim();
      const link = $(el).find('h4 a').attr('href');
      const author = $(el).find('.author').text().replace('作者：', '').trim();
      const cover = $(el).find('.book-img img').attr('src');
      const desc = $(el).find('.intro').text().trim();

      if (title) {
        results.push({
          title,
          author,
          cover: cover ? `${NOVEL_SITE}${cover}` : '',
          desc,
          link: link ? `${NOVEL_SITE}${link}` : '',
          source: '万书网'
        });
      }
    });

    res.json(results.length > 0 ? results : { message: '未找到相关小说' });
  } catch (error) {
    console.error('搜索失败:', error);
    res.status(500).json({ 
      error: '搜索失败',
      detail: error.message
    });
  }
});

// 音乐播放接口
app.get('/api/music', (req, res) => {
  res.json({
    url: 'https://music.163.com/song/media/outer/url?id=1824045033.mp3',
    title: '二次元音乐示例'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务已启动: http://localhost:${PORT}`);
});