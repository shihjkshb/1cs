// Vue 3 应用实例
const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    // 状态管理
    const searchKeyword = ref('');
    const selectedSource = ref('源1');
    const availableSources = ref(['源1', '源2', '源3']);
    const novels = ref([]);
    const loading = ref(false);
    const error = ref(null);
    
    // 音乐播放器状态
    const bgm = ref(null);
    const musicPlaying = ref(false);
    const volume = ref(0.5);
    
    // 生命周期钩子
    onMounted(() => {
      // 恢复音乐播放状态
      if(localStorage.getItem('bgmPlaying') === 'true') {
        bgm.value.play().catch(e => console.log('自动播放受阻:', e));
        musicPlaying.value = true;
      }
      
      // 加载书源
      fetch('/api/sources')
        .then(res => res.json())
        .then(data => availableSources.value = data)
        .catch(console.error);
    });
    
    // 搜索小说
    const searchNovels = async () => {
      if (!searchKeyword.value.trim()) {
        error.value = '请输入搜索关键词';
        return;
      }
      
      loading.value = true;
      error.value = null;
      
      try {
        const response = await fetch(
          `/api/search?keyword=${encodeURIComponent(searchKeyword.value)}&source=${selectedSource.value}`
        );
        
        if (!response.ok) {
          throw new Error('搜索失败');
        }
        
        const data = await response.json();
        novels.value = data;
      } catch (err) {
        error.value = err.message;
        novels.value = [];
      } finally {
        loading.value = false;
      }
    };
    
    // 下载小说
    const downloadNovel = (novel) => {
      console.log('下载:', novel.title);
      // 实际下载逻辑需要后端API支持
      alert(`开始下载: ${novel.title}`);
    };
    
    // 音乐控制
    const toggleMusic = () => {
      if (musicPlaying.value) {
        bgm.value.pause();
      } else {
        bgm.value.play();
      }
      musicPlaying.value = !musicPlaying.value;
      localStorage.setItem('bgmPlaying', musicPlaying.value);
    };
    
    // 音量控制
    const updateVolume = () => {
      bgm.value.volume = volume.value;
    };
    
    // 重试搜索
    const retry = () => {
      error.value = null;
      searchNovels();
    };
    
    return {
      // 状态
      searchKeyword,
      selectedSource,
      availableSources,
      novels,
      loading,
      error,
      bgm,
      musicPlaying,
      volume,
      
      // 方法
      searchNovels,
      downloadNovel,
      toggleMusic,
      updateVolume,
      retry
    };
  }
}).mount('#app');