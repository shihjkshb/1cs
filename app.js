const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    // 状态管理
    const searchKeyword = ref('');
    const novels = ref([]);
    const loading = ref(false);
    const error = ref(null);
    
    // 音乐播放器状态
    const audio = new Audio();
    const musicPlaying = ref(false);
    const musicInfo = ref({
      url: '',
      title: '加载中...'
    });
    
    // 初始化音乐
    const initMusic = async () => {
      try {
        const response = await fetch('/api/music');
        const data = await response.json();
        musicInfo.value = data;
        audio.src = data.url;
        audio.loop = true;
      } catch (err) {
        console.error('音乐加载失败:', err);
      }
    };
    
    // 搜索小说
    const searchNovels = async () => {
      if (!searchKeyword.value.trim()) {
        error.value = '请输入搜索关键词';
        return;
      }
      
      loading.value = true;
      error.value = null;
      novels.value = [];
      
      try {
        const response = await fetch(
          `/api/search?keyword=${encodeURIComponent(searchKeyword.value)}`
        );
        
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        
        novels.value = Array.isArray(data) ? data : [];
        if (novels.value.length === 0) {
          error.value = '未找到相关小说，请尝试其他关键词';
        }
      } catch (err) {
        error.value = err.message || '搜索失败';
      } finally {
        loading.value = false;
      }
    };
    
    // 控制音乐
    const toggleMusic = () => {
      if (musicPlaying.value) {
        audio.pause();
      } else {
        audio.play().catch(e => console.log('播放失败:', e));
      }
      musicPlaying.value = !musicPlaying.value;
    };
    
    // 页面加载时初始化
    onMounted(() => {
      initMusic();
    });
    
    return {
      // 状态
      searchKeyword,
      novels,
      loading,
      error,
      musicPlaying,
      musicInfo,
      
      // 方法
      searchNovels,
      toggleMusic
    };
  }
}).mount('#app');