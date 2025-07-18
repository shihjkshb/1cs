const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const redis = require('redis');
const schedule = require('node-schedule');

const app = express();
app.use(cors());
app.use(express.json());

// 初始化Redis客户端
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});
redisClient.on('error', err => console.log('Redis Error:', err));
redisClient.connect();

// 书源存储文件
const SOURCES_FILE = 'sources.json';

// 加载书源
function loadSources() {
  try {
    return JSON.parse(fs.readFileSync(SOURCES_FILE));
  } catch {
    // 默认书源
    return [
      {
        name: '源1',
        url: 'https://shuyuan-api.yiove.com/redirect/shuyuan/20250120201434.json',
        enabled: true,
        lastChecked: new Date().toISOString()
      }
    ];
  }
}

// 保存书源
function saveSources(sources) {
  fs.writeFileSync(SOURCES_FILE, JSON.stringify(sources, null, 2));
}

let bookSources = loadSources();

// 书源健康检查
async function checkSourceHealth(source) {
  try {
    const start = Date.now();
    await axios.head(source.url, { timeout: 5000 });
    source.latency = Date.now() - start;
    source.lastChecked = new Date().toISOString();
    source.enabled = true;
    return true;
  } catch (error) {
    source.enabled = false;
    return false;
  }
}

// 定时任务：每30分钟检查书源
schedule.scheduleJob('*/30 * * * *', async () => {
  console.log('Running source health check...');
  await Promise.all(bookSources.map(checkSourceHealth));
  saveSources(bookSources);
});

// 自定义书源API
app.post('/api/sources', async (req, res) => {
  const newSource = req.body;
  
  // 验证书源
  if (!newSource.url || !newSource.name) {
    return res.status(400).json({ error: '缺少必要字段' });
  }

  // 检查是否已存在
  if (bookSources.some(s => s.url === newSource.url)) {
    return res.status(409).json({ error: '书源已存在' });
  }

  newSource.enabled = true;
  bookSources.push(newSource);
  saveSources(bookSources);
  
  res.json({ message: '书源添加成功', sources: bookSources });
});

// 获取缓存数据
async function getCache(key) {
  try {
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

// 设置缓存
async function setCache(key, data, ttl = 3600) {
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(data));
  } catch (err) {
    console.error('Redis set error:', err);
  }
}

// 搜索接口（带缓存和自动切换）
app.get('/api/search', async (req, res) => {
  const { keyword } = req.query;
  const cacheKey = `search:${keyword}`;

  try {
    // 检查缓存
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    // 尝试可用书源
    for (const source of bookSources.filter(s => s.enabled)) {
      try {
        const apiUrl = `${source.url}?keyword=${encodeURIComponent(keyword)}`;
        const { data } = await axios.get(apiUrl, { timeout: 5000 });
        
        // 缓存结果
        await setCache(cacheKey, data);
        
        return res.json(data);
      } catch (error) {
        console.log(`书源 ${source.name} 失败: ${error.message}`);
        continue;
      }
    }
    
    throw new Error('所有书源均不可用');
  } catch (error) {
    res.status(500).json({ 
      error: error.message,
      availableSources: bookSources.filter(s => s.enabled).map(s => s.name) 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`服务已启动: http://localhost:${PORT}`);
  // 初始健康检查
  bookSources.forEach(checkSourceHealth);
});