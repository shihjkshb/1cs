// API基础URL
const API_BASE = 'http://localhost:3000/api';

// DOM元素
const searchInput = document.getElementById('search-input');
const sourceSelect = document.getElementById('source-select');
const searchBtn = document.getElementById('search-btn');
const resultsContainer = document.querySelector('.results-container');
const templateCard = document.querySelector('.novel-card.template');
const searchView = document.getElementById('search-view');
const favoritesView = document.getElementById('favorites-view');
const navButtons = document.querySelectorAll('.nav-btn');
const favoritesList = document.querySelector('.favorites-list');
const templateFavorite = document.querySelector('.favorite-item.template');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    // 移除模板卡片的显示
    templateCard.style.display = 'none';
    templateFavorite.style.display = 'none';
    
    // 绑定搜索事件
    searchBtn.addEventListener('click', handleSearch);
    
    // 回车键搜索
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    
    // 导航切换
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.target;
            switchView(target);
        });
    });
    
    // 加载收藏
    loadFavorites();
});

// 切换视图
function switchView(target) {
    // 更新活动按钮
    navButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.target === target);
    });
    
    // 切换视图显示
    document.querySelectorAll('.view').forEach(view => {
        view.classList.toggle('active', view.id === target);
    });
    
    // 如果是收藏视图，刷新列表
    if (target === 'favorites-view') {
        loadFavorites();
    }
}

// 处理搜索
async function handleSearch() {
    const keyword = searchInput.value.trim();
    const source = sourceSelect.value;
    
    if (!keyword) {
        showMessage('请输入搜索关键词', 'error');
        return;
    }
    
    // 清空之前的结果
    resultsContainer.innerHTML = '';
    
    // 显示加载状态
    showMessage('搜索中...', 'loading');
    
    try {
        const response = await fetch(`${API_BASE}/search?keyword=${encodeURIComponent(keyword)}&source=${source}`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || '搜索失败');
        }
        
        if (data.length === 0) {
            showMessage(`没有找到与"${keyword}"相关的小说`, 'error');
            return;
        }
        
        displayResults(data);
    } catch (error) {
        showMessage('搜索失败: ' + error.message, 'error');
        console.error('搜索错误:', error);
    }
}

// 显示搜索结果
function displayResults(novels) {
    resultsContainer.innerHTML = '';
    
    novels.forEach(novel => {
        const card = templateCard.cloneNode(true);
        card.classList.remove('template');
        card.style.display = 'flex';
        
        // 填充数据
        card.querySelector('.title').textContent = novel.title;
        card.querySelector('.author').textContent = `作者: ${novel.author}`;
        card.querySelector('.desc').textContent = novel.desc || '暂无简介';
        
        // 设置封面图片
        const coverImg = card.querySelector('.cover');
        coverImg.src = novel.cover || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="300" height="400"><rect width="100%" height="100%" fill="%23f0e6ff"/><text x="50%" y="50%" font-size="20" text-anchor="middle" fill="%239d8ba6">无封面</text></svg>';
        coverImg.alt = `${novel.title}封面`;
        
        // 绑定下载事件
        const downloadFullBtn = card.querySelector('.download-full');
        const downloadRangeBtn = card.querySelector('.download-range');
        const favoriteBtn = card.querySelector('.favorite-btn');
        const startChapterInput = card.querySelector('.chapter-range input:nth-of-type(1)');
        const endChapterInput = card.querySelector('.chapter-range input:nth-of-type(2)');
        
        // 全本下载
        downloadFullBtn.addEventListener('click', async () => {
            try {
                showMessage('获取章节列表中...', 'loading');
                const chapters = await getChapters(novel.link, novel.source);
                const content = await getAllChapterContents(chapters);
                downloadNovel(novel.title, content);
            } catch (error) {
                showMessage('下载失败: ' + error.message, 'error');
                console.error('下载错误:', error);
            }
        });
        
        // 章节范围下载
        downloadRangeBtn.addEventListener('click', async () => {
            const start = parseInt(startChapterInput.value) || 1;
            const end = parseInt(endChapterInput.value) || 100;
            
            if (start < 1 || start > end) {
                showMessage('请输入有效的章节范围', 'error');
                return;
            }
            
            try {
                showMessage('获取章节列表中...', 'loading');
                const chapters = await getChapters(novel.link, novel.source);
                
                if (end > chapters.length) {
                    showMessage(`最大章节数为 ${chapters.length}`, 'error');
                    return;
                }
                
                const selectedChapters = chapters.slice(start - 1, end);
                const content = await getAllChapterContents(selectedChapters);
                downloadNovel(`${novel.title}_第${start}-${end}章`, content);
            } catch (error) {
                showMessage('下载失败: ' + error.message, 'error');
                console.error('下载错误:', error);
            }
        });
        
        // 收藏按钮
        favoriteBtn.addEventListener('click', () => {
            addToFavorites(novel);
        });
        
        // 添加到结果容器
        resultsContainer.appendChild(card);
    });
}

// 获取章节列表
async function getChapters(url, source) {
    const response = await fetch(`${API_BASE}/chapters?url=${encodeURIComponent(url)}&source=${source}`);
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || '获取章节失败');
    }
    
    return data;
}

// 获取所有章节内容
async function getAllChapterContents(chapters) {
    showMessage(`正在获取 ${chapters.length} 个章节内容...`, 'loading');
    
    let content = '';
    for (let i = 0; i < chapters.length; i++) {
        const chapter = chapters[i];
        try {
            const response = await fetch(`${API_BASE}/content?url=${encodeURIComponent(chapter.link)}`);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || '获取内容失败');
            }
            
            content += `\n\n${chapter.title}\n\n${data.content}\n`;
            
            // 更新进度
            if (i % 5 === 0 || i === chapters.length - 1) {
                showMessage(`正在获取 ${i+1}/${chapters.length} 章节...`, 'loading');
            }
        } catch (error) {
            console.error(`获取章节 ${chapter.title} 失败:`, error);
            content += `\n\n${chapter.title}\n\n[获取内容失败: ${error.message}]\n`;
        }
    }
    
    return content;
}

// 下载小说为TXT文件
function downloadNovel(filename, content) {
    // 创建Blob对象
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    
    // 创建下载链接
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${filename}.txt`;
    a.style.display = 'none';
    
    // 触发点击事件
    document.body.appendChild(a);
    a.click();
    
    // 清理
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
        showMessage('下载完成!', 'success');
    }, 100);
}

// 显示消息
function showMessage(message, type) {
    // 移除现有消息
    const existingMsg = document.querySelector('.message');
    if (existingMsg) {
        existingMsg.remove();
    }
    
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    msgDiv.textContent = message;
    
    if (type === 'loading') {
        resultsContainer.prepend(msgDiv);
    } else {
        const currentView = document.querySelector('.view.active');
        currentView.prepend(msgDiv);
    }
    
    // 错误消息3秒后消失
    if (type === 'error') {
        setTimeout(() => {
            msgDiv.remove();
        }, 3000);
    }
}

// 收藏功能
async function addToFavorites(novel) {
    try {
        const response = await fetch(`${API_BASE}/favorites`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ novel })
        });
        
        if (!response.ok) {
            throw new Error('收藏失败');
        }
        
        showMessage('已添加到收藏!', 'success');
        loadFavorites();
    } catch (error) {
        showMessage('收藏失败: ' + error.message, 'error');
        console.error('收藏错误:', error);
    }
}

async function loadFavorites() {
    try {
        const response = await fetch(`${API_BASE}/favorites`);
        const favorites = await response.json();
        
        if (!response.ok) {
            throw new Error('获取收藏失败');
        }
        
        renderFavorites(favorites);
    } catch (error) {
        showMessage('加载收藏失败: ' + error.message, 'error');
        console.error('加载收藏错误:', error);
    }
}

function renderFavorites(favorites) {
    favoritesList.innerHTML = '';
    
    if (favorites.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'empty-message';
        emptyMsg.textContent = '暂无收藏小说';
        favoritesList.appendChild(emptyMsg);
        return;
    }
    
    favorites.forEach((novel, index) => {
        const item = templateFavorite.cloneNode(true);
        item.classList.remove('template');
        item.style.display = 'flex';
        
        item.querySelector('.title').textContent = novel.title;
        item.querySelector('.author').textContent = `作者: ${novel.author}`;
        
        const coverImg = item.querySelector('.cover');
        coverImg.src = novel.cover || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="80" height="100"><rect width="100%" height="100%" fill="%23f0e6ff"/><text x="50%" y="50%" font-size="12" text-anchor="middle" fill="%239d8ba6">无封面</text></svg>';
        coverImg.alt = `${novel.title}封面`;
        
        // 下载按钮
        item.querySelector('.download-favorite').addEventListener('click', async () => {
            try {
                showMessage('获取章节列表中...', 'loading');
                const chapters = await getChapters(novel.link, novel.source);
                const content = await getAllChapterContents(chapters);
                downloadNovel(novel.title, content);
            } catch (error) {
                showMessage('下载失败: ' + error.message, 'error');
                console.error('下载错误:', error);
            }
        });
        
        // 移除按钮
        item.querySelector('.remove-favorite').addEventListener('click', async () => {
            try {
                const response = await fetch(`${API_BASE}/favorites/${index}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) {
                    throw new Error('移除失败');
                }
                
                showMessage('已从收藏移除', 'success');
                loadFavorites();
            } catch (error) {
                showMessage('移除失败: ' + error.message, 'error');
                console.error('移除错误:', error);
            }
        });
        
        favoritesList.appendChild(item);
    });
}

// 添加一些样式到DOM
const style = document.createElement('style');
style.textContent = `
    .message {
        text-align: center;
        padding: 15px;
        margin-bottom: 20px;
        border-radius: 10px;
        font-size: 1rem;
    }
    
    .message.loading {
        background-color: #e2c2ff;
        color: white;
    }
    
    .message.error {
        background-color: #ffb6c1;
        color: white;
    }
    
    .message.success {
        background-color: #b6ffc1;
        color: #3d5c42;
    }
    
    .empty-message {
        text-align: center;
        padding: 30px;
        color: #9d8ba6;
    }
`;
document.head.appendChild(style);