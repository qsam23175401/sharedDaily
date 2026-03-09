// --- 設定與初始化 ---
// 從 localStorage 讀取 API Key，而非硬編碼
let API_KEY = localStorage.getItem('gemini_api_key') || "";
let currentMood = "";
let entries = [];
const diaryData = JSON.parse(localStorage.getItem('my_diaries') || '{}');

// 心情標籤設定
const defaultMoodLabels = {
    "#ffadad": "紅色 (生氣/熱情)",
    "#ffd6a5": "橘色 (開心)",
    "#fdffb6": "黃色 (平靜)",
    "#caffbf": "綠色 (放鬆)",
    "#9bf6ff": "藍色 (憂鬱/冷靜)",
    "#bdb2ff": "紫色 (浪漫/神祕)"
};
let userMoodLabels = JSON.parse(localStorage.getItem('mood_labels')) || {};
for (let key in defaultMoodLabels) {
    if (!userMoodLabels[key]) userMoodLabels[key] = defaultMoodLabels[key];
}

// 初始化日期 (Android WebView 可能無法正確解析 valueAsDate，因此改由字串手動指定日期以確保有預設值)
const initDate = new Date();
const yyyy = initDate.getFullYear();
const mm = (initDate.getMonth() + 1 < 10 ? '0' : '') + (initDate.getMonth() + 1);
const dd = (initDate.getDate() < 10 ? '0' : '') + initDate.getDate();

document.getElementById('diary-date').value = `${yyyy}-${mm}-${dd}`;
document.getElementById('filter-month').value = `${yyyy}-${mm}`;

renderMoodOptions();

// 心情選擇器邏輯
document.querySelectorAll('.mood-dot').forEach(dot => {
    const handleMoodClick = (e) => {
        if (e.type === 'touchstart') e.preventDefault(); // 防止雙重觸發
        document.querySelectorAll('.mood-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        currentMood = dot.dataset.color;
    };
    dot.addEventListener('click', handleMoodClick);
    dot.addEventListener('touchstart', handleMoodClick, { passive: false });
});

// --- 切換視圖 ---
function switchView(view) {
    document.getElementById('view-list').classList.toggle('hidden', view !== 'list');
    document.getElementById('view-write').classList.toggle('hidden', view !== 'write');
    document.getElementById('view-settings').classList.toggle('hidden', view !== 'settings');

    if (view === 'list') renderDiaryList();
    if (view === 'settings') {
        document.getElementById('api-key-input').value = API_KEY;
        // 載入自訂的心情標籤至設定介面中
        document.querySelectorAll('#mood-label-inputs input').forEach(input => {
            input.value = userMoodLabels[input.dataset.color];
        });
    }
}

// --- 心情標籤功能 ---
function renderMoodOptions() {
    const select = document.getElementById('filter-mood');
    select.innerHTML = '<option value="">所有心情顏色</option>';
    const colors = ['#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#bdb2ff'];
    colors.forEach(color => {
        const label = userMoodLabels[color];
        select.innerHTML += `<option value="${color}">${label}</option>`;
    });
    // 更新寫作區的心情圓點提示（hover即可顯示）
    document.querySelectorAll('.mood-dot').forEach(dot => {
        dot.title = userMoodLabels[dot.dataset.color];
    });
}

function saveMoodLabels() {
    const inputs = document.querySelectorAll('#mood-label-inputs input');
    inputs.forEach(input => {
        const color = input.dataset.color;
        if (input.value.trim()) {
            userMoodLabels[color] = input.value.trim();
        } else {
            userMoodLabels[color] = defaultMoodLabels[color];
        }
    });
    localStorage.setItem('mood_labels', JSON.stringify(userMoodLabels));
    renderMoodOptions();
    alert("心情標籤已儲存！");
    switchView('write');
}

// --- AI 功能：Gemini API ---
async function callGemini(prompt) {
    if (!API_KEY) {
        if (confirm("您尚未設定 Gemini API Key，請先前往設定頁面輸入。是否現在前往？")) {
            switchView('settings');
        }
        return null;
    }
    // 更新為最新的模型 (gemini-2.5-flash)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });
        const data = await response.json();

        // 檢查 HTTP 狀態碼是否成功
        if (!response.ok) {
            console.error("Gemini API 回傳錯誤:", data);
            const errMsg = data.error?.message || "未知的錯誤。請確認設定中的 API Key 是否有效。";
            alert(`AI 模型發生錯誤 (HTTP ${response.status}):\n${errMsg}`);
            return null;
        }

        if (!data.candidates || data.candidates.length === 0) {
            console.error("Gemini API 未回傳有效的內容:", data);
            alert("AI 未能產生有效的內容，請稍後再試。");
            return null;
        }

        return data.candidates[0].content.parts[0].text;
    } catch (err) {
        console.error("Fetch 請求失敗:", err);
        alert("發送請求至 AI 服務失敗，請確認網路連線或檢查 API Key 授權。");
        return null;
    }
}

// --- 錄音功能 ---
let recognition = null;
let isRecording = false;

function startVoice() {
    if (!navigator.onLine) {
        alert("目前處於離線狀態，無法使用語音解析功能！請確認網路連線。");
        return;
    }

    const btn = document.getElementById('voice-btn');

    // 若正在錄音中，則停止錄音
    if (isRecording && recognition) {
        recognition.stop();
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 處理中...';
        return;
    }

    // 初始化錄音物件 (每次啟動時重新建立以避免狀態殘留)
    recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'zh-TW';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        isRecording = true;
        btn.innerHTML = '<i class="fas fa-stop-circle"></i> 停止錄音';
        btn.classList.replace('bg-red-500', 'bg-red-400');
    };

    recognition.onresult = async (event) => {
        isRecording = false;
        const transcript = event.results[0][0].transcript;
        btn.innerHTML = '<i class="fas fa-robot fa-spin"></i> AI 解析中...';
        btn.classList.replace('bg-red-400', 'bg-red-500');

        // 將語音辨識的結果傳給 Gemini API
        const prompt = `請將以下這段口述日記解析為 JSON 格式，包含 "time_point" (時間點) 和 "content" (具體內容)。
                範例輸入：上午上班時因為塞車而遲到，心情不好，還好主管沒生氣。
                範例輸出：{"time_point": "上午上班時", "content": "因為塞車而遲到，心情不好，還好主管沒生氣。"}
                輸入內容：${transcript}`;

        try {
            const aiResult = await callGemini(prompt);
            if (aiResult) {
                const cleanJson = aiResult.replace(/```json|```/g, '');
                try {
                    const entry = JSON.parse(cleanJson);
                    addEntryToUI(entry.time_point || '剛才', entry.content);
                } catch (parseErr) {
                    console.error("JSON 解析失敗", parseErr, cleanJson);
                    alert("AI 回傳的格式不正確，無法解析為日誌。");
                }
            }
        } catch (e) {
            alert("處理過程中發生意外錯誤");
            console.error(e);
        }
        resetVoiceBtn();
    };

    recognition.onerror = (e) => {
        console.error("錄音錯誤:", e.error);
        isRecording = false;
        resetVoiceBtn();
    };

    recognition.onend = () => {
        // 如果已經結束但未進入 onresult，可能是因為使用者沒講話
        if (isRecording) {
            isRecording = false;
            resetVoiceBtn();
        }
    };

    // 開始錄音
    try {
        recognition.start();
    } catch (e) {
        console.error("無法啟動語音辨識:", e);
        alert("啟動語音辨識失敗，可能是您的瀏覽器或設備不支援該功能。");
        resetVoiceBtn();
    }
}

function resetVoiceBtn() {
    const btn = document.getElementById('voice-btn');
    btn.innerHTML = '<i class="fas fa-microphone"></i> 錄音解析';
    btn.classList.replace('bg-red-400', 'bg-red-500'); // 還原按鈕顏色
    isRecording = false;
    recognition = null;
}

// --- 條目管理 ---
function addManualEntry() {
    const timeInput = document.getElementById('manual-time');
    const time = timeInput.value.trim() || '';
    const text = document.getElementById('manual-input').value;

    if (!text) {
        alert("請先輸入日記內容喔！");
        return;
    }

    addEntryToUI(time, text);
    document.getElementById('manual-input').value = '';
    timeInput.value = ''; // 記錄完畢後將時間點重置，方便連續輸入
}

function addEntryToUI(time, content) {
    entries.push({ time, content });
    renderEntries();
}

function renderEntries() {
    const list = document.getElementById('entries-list');
    list.innerHTML = entries.map((e, index) => `
                <div class="bg-gray-50 p-3 sm:p-4 rounded-lg border-l-4 border-indigo-400">
                    <div class="text-xs text-indigo-500 font-bold mb-1">${e.time}</div>
                    <div class="text-gray-700 break-words">${e.content}</div>
                </div>
            `).join('');
}

// --- 生成總結 ---
async function generateSummary() {
    if (!navigator.onLine) {
        alert("目前處於離線狀態，無法使用 AI 自動總結功能！請確認網路連線。");
        return;
    }
    if (entries.length === 0) return alert("請先寫一些小記喔！");
    const btn = event.target;
    btn.innerText = "生成中...";

    const logsText = entries.map(e => `${e.time}: ${e.content}`).join('\n');
    const prompt = `根據以下的小記內容，寫一段溫馨且精簡的當日總結（約50字），並在最後給予一句鼓勵的話：\n${logsText}`;

    const summary = await callGemini(prompt);
    if (summary) {
        document.getElementById('daily-summary').value = summary;
    }
    btn.innerHTML = '<i class="fas fa-magic"></i> AI 自動生成';
}

// --- 儲存與讀取 ---
function saveApiKey() {
    const key = document.getElementById('api-key-input').value.trim();
    if (key) {
        API_KEY = key;
        localStorage.setItem('gemini_api_key', key);
        document.getElementById('api-key-input').value = '';
        alert("API Key 解析成功，設定已儲存！");
        switchView('write'); // 儲存後導回寫日記模式
    } else {
        alert("API Key 不能為空");
    }
}

function saveDiary() {
    const date = document.getElementById('diary-date').value;
    const summary = document.getElementById('daily-summary').value;

    if (!date) return alert("請選擇日期");

    diaryData[date] = {
        entries: [...entries],
        summary,
        mood: currentMood
    };

    localStorage.setItem('my_diaries', JSON.stringify(diaryData));
    alert("日記已儲存！");
    entries = []; // 清空
    switchView('list');
}

function renderDiaryList() {
    const container = document.getElementById('diary-container');
    const filterMonth = document.getElementById('filter-month').value; // YYYY-MM
    const filterMood = document.getElementById('filter-mood').value;

    container.innerHTML = "";

    const sortedDates = Object.keys(diaryData).sort().reverse();

    sortedDates.forEach(date => {
        const data = diaryData[date];

        // 篩選過濾
        if (filterMonth && !date.startsWith(filterMonth)) return;
        if (filterMood && data.mood !== filterMood) return;

        const card = document.createElement('div');
        card.className = "bg-white p-4 rounded-xl shadow-sm border-r-8 cursor-pointer hover:shadow-md transition";
        card.style.borderRightColor = data.mood || '#eee';
        card.innerHTML = `
                    <div class="flex justify-between items-start">
                        <h4 class="font-bold text-lg">${date}</h4>
                        <span class="text-xs text-gray-400">${data.entries.length} 則紀錄</span>
                    </div>
                    <p class="text-gray-600 text-sm mt-2 line-clamp-2">${data.summary || '點擊查看詳情...'}</p>
                `;
        card.onclick = () => loadDiaryToEdit(date);
        container.appendChild(card);
    });
}

function loadDiaryToEdit(date) {
    const data = diaryData[date];
    document.getElementById('diary-date').value = date;
    entries = [...data.entries];
    document.getElementById('daily-summary').value = data.summary;
    currentMood = data.mood;

    // 更新 UI 狀態
    renderEntries();
    document.querySelectorAll('.mood-dot').forEach(dot => {
        dot.classList.toggle('active', dot.dataset.color === currentMood);
    });
    switchView('write');
}

// 監聽過濾器
document.getElementById('filter-month').addEventListener('change', renderDiaryList);
document.getElementById('filter-mood').addEventListener('change', renderDiaryList);

// --- 離線狀態監聽 ---
function updateNetworkStatus() {
    const banner = document.getElementById('offline-banner');
    const voiceBtn = document.getElementById('voice-btn');

    if (navigator.onLine) {
        if (banner) banner.classList.add('hidden');
        if (voiceBtn) voiceBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        if (banner) banner.classList.remove('hidden');
        if (voiceBtn) voiceBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

window.addEventListener('online', updateNetworkStatus);
window.addEventListener('offline', updateNetworkStatus);
// 初始化檢查網路狀態
updateNetworkStatus();