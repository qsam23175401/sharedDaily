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
const userMoodLabels = JSON.parse(localStorage.getItem('mood_labels')) || {};
for (let key in defaultMoodLabels) {
    if (!userMoodLabels[key]) userMoodLabels[key] = defaultMoodLabels[key];
}

// AI 提示詞設定
const defaultAiSettings = {
    person: "第一人稱",
    focus: "自由敘事",
    attitude: "中立",
    custom: ""
};
let aiSettings = JSON.parse(localStorage.getItem('ai_settings')) || { ...defaultAiSettings };

// 初始化日期 (Android WebView 可能無法正確解析 valueAsDate，因此改由字串手動指定日期以確保有預設值)
const initDate = new Date();
const yyyy = initDate.getFullYear();
const mm = (initDate.getMonth() + 1 < 10 ? '0' : '') + (initDate.getMonth() + 1);
const dd = (initDate.getDate() < 10 ? '0' : '') + initDate.getDate();

document.getElementById('diary-date').value = `${yyyy}-${mm}-${dd}`;
document.getElementById('filter-month').value = `${yyyy}-${mm}`;

// 隨機提示詞清單
function setRandomPlaceholder() {
    const PLACEHOLDER_PROMPTS = [
        "有發生了什麼事呢？",
        "現在的心情如何？用文字記錄下來吧...",
        "身體的感覺如何？",
        "有沒有哪瞬間讓你覺得很有成就感？",
        "寫下在意的事情如何？",
        "如果現在要用一個詞形容，那會是什麼？",
        "最想對剛才的自己說什麼？",
        "有沒有哪件事讓你覺得特別溫暖？",
        "有沒有什麼事情一直懸在心上？",
        "隨意寫點什麼吧，這裡是屬於你的空間...",
        "試著寫下心中的如果小劇場？",
        "有什麼事令你心有戚戚？"
    ];
    const nowHour = new Date().getHours();
    const listofTime = [1, 4, 7, 10, 13, 16, 19, 22]
    let min = 2;
    for (t of listofTime) {
        const abs = Math.abs(nowHour - t);
        if (abs < min) {
            min = t;
            break;
        }
    }
    const listofHour = `listOf${min}`

    let listOfMore = {
        listOf1: [
            '是為了什麼熬夜呢？',
            '還有什麼事情掛念著嗎？',
            '寫下精彩的夜生活？'
        ],
        listOf4: [
            '今天起的真早！正要做什麼呢？',
            '現在起床是因為睡不著嗎？',
            '是否做噩夢了？要寫下來嗎？'
        ],
        listOf7: [
            '早安！現在心情如何？',
            '今天早上的心情怎麼樣？',
            '接下來打算怎麼渡過這一天？'
        ],
        listOf10: [
            '手邊的事情是否順利呢？',
            '現在的心情比起床時好一點嗎？',
            '是否已經完成了一些任務？'
        ],
        listOf13: [
            '休息足夠嗎？還有半天，別太勉強了！',
            '把你的疲勞寫下來如何？',
            '期待下午的計劃嗎？'
        ],
        listOf16: [
            '今天都遇到什麼樣的人呢？',
            '今天有發現什麼新事物嗎？',
            '今天的挑戰是什麼？'
        ],
        listOf19: [
            '今天有什麼想感謝的人或事嗎？',
            '晚安！睡前想寫下什麼？',
            '今天有沒有抽時間運動呢？'
        ],
        listOf22: [
            '任務接近尾聲了嗎？',
            '身體是否覺得累了？',
            '寫日記比睡覺還重要呢！'
        ],
    }
    PLACEHOLDER_PROMPTS.push(...listOfMore[listofHour]);

    const textarea = document.getElementById('manual-input');
    const sunmary = document.getElementById('daily-summary')
    if (textarea) {
        const randomIndex = Math.floor(Math.random() * PLACEHOLDER_PROMPTS.length);
        textarea.placeholder = `${PLACEHOLDER_PROMPTS[randomIndex]}\n(請隨意寫下供稍後回憶的片段...)`;
        sunmary.placeholder = `這一天過得如何呢？\n寫些話給自己吧！\n（請AI寫的話，設定可以修改提示詞）`;
    }
}

// --- 自動讀取今日內容 ---
function loadInitialContent() {
    const today = document.getElementById('diary-date').value;

    // 檢查是否有暫存
    const draftStr = localStorage.getItem('diary_draft');
    if (draftStr) {
        const draft = JSON.parse(draftStr);
        if (draft.date && draft.date !== today) {
            // 跨夜作業：發現昨天的暫存，自動幫忙存檔
            diaryData[draft.date] = {
                entries: draft.entries || [],
                summary: draft.summary || "",
                mood: draft.mood || ""
            };
            localStorage.setItem('my_diaries', JSON.stringify(diaryData));
            localStorage.removeItem('diary_draft');
        } else if (draft.date === today) {
            entries = draft.entries || [];
            document.getElementById('daily-summary').value = draft.summary || "";
            currentMood = draft.mood || "";
        }
    }

    // 如果沒有載入到暫存 (或者暫存剛被自動轉存了)，檢查是否已有儲存的內容
    if ((!entries || entries.length === 0) && !document.getElementById('daily-summary').value) {
        const savedData = diaryData[today];
        if (savedData) {
            entries = [...savedData.entries];
            document.getElementById('daily-summary').value = savedData.summary || "";
            currentMood = savedData.mood || "";
        }
    }

    // 更新 UI
    renderEntries();
    updateMoodUI();
}

function updateMoodUI() {
    document.querySelectorAll('.mood-dot').forEach(dot => {
        dot.classList.toggle('active', dot.dataset.color === currentMood);
    });
}

function autoSaveDraft() {
    const date = document.getElementById('diary-date').value;
    const summary = document.getElementById('daily-summary').value;
    const draft = {
        date,
        entries,
        summary,
        mood: currentMood
    };
    localStorage.setItem('diary_draft', JSON.stringify(draft));
}

// 監聽總結輸入以自動存檔
document.getElementById('daily-summary').addEventListener('input', autoSaveDraft);
// 監聽日期變更載入對應內容
document.getElementById('diary-date').addEventListener('change', (e) => {
    const selectedDate = e.target.value;
    const savedData = diaryData[selectedDate];
    if (savedData) {
        entries = [...savedData.entries];
        document.getElementById('daily-summary').value = savedData.summary || "";
        currentMood = savedData.mood || "";
    } else {
        entries = [];
        document.getElementById('daily-summary').value = "";
        currentMood = "";
    }
    renderEntries();
    updateMoodUI();
    autoSaveDraft();
});

renderMoodOptions();
loadInitialContent();
setRandomPlaceholder();

// 心情選擇器邏輯
document.querySelectorAll('.mood-dot').forEach(dot => {
    const handleMoodClick = (e) => {
        if (e.type === 'touchstart') e.preventDefault(); // 防止雙重觸發
        document.querySelectorAll('.mood-dot').forEach(d => d.classList.remove('active'));
        dot.classList.add('active');
        currentMood = dot.dataset.color;
    };
    dot.addEventListener('click', (e) => {
        handleMoodClick(e);
        autoSaveDraft();
    });
    dot.addEventListener('touchstart', (e) => {
        handleMoodClick(e);
        autoSaveDraft();
    }, { passive: false });
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
        // 載入 AI 提示詞設定至介面
        document.getElementById('ai-setting-person').value = aiSettings.person;
        document.getElementById('ai-setting-focus').value = aiSettings.focus;
        document.getElementById('ai-setting-attitude').value = aiSettings.attitude;
        document.getElementById('ai-setting-custom').placeholder = `讓Gemini模仿你寫日記的習慣。\n範例一：請用一首五言絕句總結我的一天。\n範例二：以第一人稱視角撰寫，更多關注在視覺脈絡上，語氣像挖掘與探索。`;
        document.getElementById('ai-setting-custom').value = aiSettings.custom;
    }
    if (view === 'write') setRandomPlaceholder();
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

// --- AI 提示詞設定功能 ---
function saveAiSettings() {
    aiSettings.person = document.getElementById('ai-setting-person').value;
    aiSettings.focus = document.getElementById('ai-setting-focus').value;
    aiSettings.attitude = document.getElementById('ai-setting-attitude').value;
    aiSettings.custom = document.getElementById('ai-setting-custom').value.trim();

    localStorage.setItem('ai_settings', JSON.stringify(aiSettings));
    alert("提示詞設定已儲存！");
}

// --- AI 功能：Gemini API ---
async function callGemini(prompt, audioData = null) {
    if (!API_KEY) {
        if (confirm("您尚未設定 Gemini API Key，請先前往設定頁面輸入。是否現在前往？")) {
            switchView('settings');
        }
        return null;
    }
    // 更新為最新的模型 (gemini-2.5-flash)，該模型支援多模態 (Multimodal) 包含音頻
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    let parts = [{ text: prompt }];
    if (audioData) {
        parts.push({
            inlineData: {
                mimeType: audioData.mimeType,
                data: audioData.base64
            }
        });
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: parts }]
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

// --- 錄音功能 (直接交由 Gemini 處理) ---
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let globalStream = null; // 全域保存麥克風串流，避免重複詢問權限

async function startVoice() {
    if (!navigator.onLine) {
        alert("目前處於離線狀態，無法使用語音解析功能！請確認網路連線。");
        return;
    }

    const btn = document.getElementById('voice-btn');

    // 若正在錄音中，則停止錄音
    if (isRecording && mediaRecorder) {
        mediaRecorder.stop();
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 處理錄音...';
        return;
    }

    try {
        if (!globalStream) {
            // 只有在還沒有授權的時候才要求權限 (這樣就不會每次點擊都問)
            globalStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }

        isRecording = true;
        // 優先嘗試使用 webm 格式，因 Gemini 支援良好；若不支援（如 Safari）則不指定讓瀏覽器決定
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
        mediaRecorder = new MediaRecorder(globalStream, mimeType ? { mimeType } : undefined);
        audioChunks = [];

        mediaRecorder.onstart = () => {
            btn.innerHTML = '<i class="fas fa-stop-circle"></i> 停止錄音';
            btn.classList.replace('bg-red-500', 'bg-red-400');
        };

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            isRecording = false;
            // 釋放麥克風資源
            if (globalStream) {
                globalStream.getTracks().forEach(track => track.stop());
                globalStream = null;
            }

            if (audioChunks.length === 0) {
                resetVoiceBtn();
                return;
            }

            btn.innerHTML = '<i class="fas fa-robot fa-spin"></i> AI 解析中...';
            btn.classList.replace('bg-red-400', 'bg-red-500');

            const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });

            // 將 Blob 轉為 Base64 (Gemini API 所需格式)
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64data = reader.result.split(',')[1];

                const prompt = `請聆聽這段錄音，並將其中的口述內容理解後，解析輸出為嚴格 JSON 格式。
需要包含 "time_point" (簡短描述時間，如：剛才、上午、下午、晚上、剛剛開會時) 和 "content" (整理除去時間的口述內容，盡量完整且通順)。
如果沒有明確提到時間，請填入空字串 "" 作為 time_point。
格式必須是嚴格的 JSON，不要有額外的文字：
{"time_point": "上午", "content": "因為塞車而遲到，心情不好..."}`;

                try {
                    const aiResult = await callGemini(prompt, {
                        mimeType: audioBlob.type || 'audio/webm',
                        base64: base64data
                    });

                    if (aiResult) {
                        const cleanJson = aiResult.replace(/```json|```/g, '');
                        try {
                            const entry = JSON.parse(cleanJson);
                            document.getElementById('manual-time').value = entry.time_point;
                            document.getElementById('manual-input').value = entry.content;
                            // 這裡不直接 addEntryToUI 是為了讓使用者確認解析內容
                        } catch (parseErr) {
                            console.error("JSON 解析失敗", parseErr, cleanJson);
                            alert("AI 回傳的格式不正確，無法解析為日誌。");
                        }
                    }
                } catch (e) {
                    alert("處理音檔或請求 API 時發生意外錯誤");
                    console.error(e);
                }
                resetVoiceBtn();
            };
        };

        mediaRecorder.start();

    } catch (err) {
        console.error("無法存取麥克風:", err);
        alert("無法啟動錄音，請確認您已允許瀏覽器存取麥克風權限。");
        resetVoiceBtn();
    }
}

function resetVoiceBtn() {
    const btn = document.getElementById('voice-btn');
    btn.innerHTML = '<i class="fas fa-microphone"></i> 語音輸入';
    btn.classList.replace('bg-red-400', 'bg-red-500'); // 還原按鈕顏色
    isRecording = false;
    mediaRecorder = null;
    audioChunks = [];
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
    setRandomPlaceholder();
}

//添加小記時，當日已有內容，所以自動儲存比暫存好。
function addEntryToUI(time, content) {
    entries.push({ time, content });
    renderEntries();
    //autoSaveDraft();
    saveDiary(true);
}

function renderEntries() {
    const list = document.getElementById('entries-list');
    list.innerHTML = entries.map((e, index) => `
                <div class="bg-gray-50 p-3 sm:p-4 rounded-lg border-l-4 border-indigo-400 relative group">
                    <button onclick="deleteEntry(${index})" class="absolute top-2 right-2 text-gray-400 hover:text-red-500 transition px-2 py-1">
                        <i class="fas fa-times"></i>
                    </button>
                    <div class="text-xs text-indigo-500 font-bold mb-1 pr-6">${e.time}</div>
                    <div class="text-gray-700 break-words pr-2">${e.content}</div>
                </div>
            `).join('');
}

function deleteEntry(index) {
    if (confirm("確定要刪除這筆小記嗎？")) {
        entries.splice(index, 1);
        renderEntries();
        autoSaveDraft();
    }
}

// --- 生成總結 ---
async function generateSummary(e) {
    if (!navigator.onLine) {
        alert("目前處於離線狀態，無法使用 AI 幫我寫日記功能！請確認網路連線。");
        return;
    }
    if (entries.length === 0) {
        const manualInput = document.getElementById('manual-input').value.trim();
        if (manualInput) {
            addManualEntry();
        } else {
            return alert("請先寫一些小記喔！");
        }
    }
    const promptSettins = getPromptSettins()
    const btn = e.target;
    btn.innerText = "生成中...";
    const logsText = entries.map(e => `${e.time}: ${e.content}`).join('\n');
    const prompt = `目標：\n根據以下「今日小記」的內容填入當日總結，不要生成「當日總結：」。\n日記本主人要求：${promptSettins}\n今日小記：\n${logsText}當日總結：\n`;

    const summary = await callGemini(prompt);
    if (summary) {
        document.getElementById('daily-summary').value = summary;
        autoSaveDraft();
    }
    btn.innerHTML = '<i class="fas fa-magic"></i> AI 自動生成';
    saveDiary(true)
}

//取得設定中的提示詞
function getPromptSettins() {
    if (aiSettings.custom) {
        return aiSettings.custom;
    }
    const person = aiSettings.person;
    const focusOn = aiSettings.focus;
    const attitude = aiSettings.attitude;

    let focusText = focusOn === "自由敘事" ? "" : `更多關注在「${focusOn}」上`;
    let attitudeText = `語氣要「${attitude}」`;

    return `以${person}視角撰寫，${focusText}${focusText ? "，" : ""}${attitudeText}。`;
}

// --- 儲存與讀取 ---
function toggleApiKeyVisibility() {
    const input = document.getElementById('api-key-input');
    const icon = document.getElementById('toggle-api-key-icon');
    if (input.style.webkitTextSecurity === 'disc') {
        input.style.webkitTextSecurity = 'none';
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.style.webkitTextSecurity = 'disc';
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

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

function saveDiary(auto = false) {
    const date = document.getElementById('diary-date').value;
    const summary = document.getElementById('daily-summary').value;

    if (!date) return alert("請選擇日期");

    diaryData[date] = {
        entries: [...entries],
        summary,
        mood: currentMood
    };

    localStorage.setItem('my_diaries', JSON.stringify(diaryData));
    localStorage.removeItem('diary_draft'); // 儲存正式版後移除暫存
    if (!auto) alert("日記已儲存！");
    // 不再清空 entries，讓使用者能看到剛儲存的結果 (符合「開啟即載入」邏輯)
    //switchView('list');
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