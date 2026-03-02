// --- Data ---
const WAGON_TYPES = [
  "Вагоны-хопперы",
  "Вагоны-Думпкары",
  "Платформы",
  "Полувагоны",
  "Транспортеры",
  "Ходовые части",
  "Вагоны-цистерны",
  "Вагоны крытые",
];

const WAGON_CATALOG = [
  {
    id: 1,
    title: "Вагоны-хопперы",
    description:
      "Предназначены для перевозки сыпучих грузов (зерно, цемент, удобрения). Саморазгружающиеся.",
    image: "/pic/hopper.png",
    price: "от 4 500 000 ₽",
  },
  {
    id: 2,
    title: "Вагоны-Думпкары",
    description:
      "Для перевозки и автоматизированной выгрузки вскрышных пород и руд.",
    image: "/pic/dumpkar.png",
    price: "от 5 200 000 ₽",
  },
  {
    id: 3,
    title: "Платформы",
    description:
      "Универсальные и специализированные для перевозки контейнеров, техники и длинномерных грузов.",
    image: "/pic/platforma.png",
    price: "от 3 800 000 ₽",
  },
  {
    id: 4,
    title: "Полувагоны",
    description:
      "Самый массовый тип вагона для навалочных грузов, не требующих защиты от осадков.",
    image: "/pic/poluvagon.png",
    price: "от 4 100 000 ₽",
  },
  {
    id: 5,
    title: "Транспортеры",
    description:
      "Для перевозки сверхтяжелых и крупногабаритных грузов массой до 500 тонн.",
    image: "/pic/transporter.png",
    price: "по запросу",
  },
  {
    id: 6,
    title: "Вагоны крытые",
    description:
      "Для грузов, требующих защиты от атмосферных воздействий и краж.",
    image: "/pic/kritie.png",
    price: "от 4 300 000 ₽",
  },
  {
    id: 7,
    title: "Вагоны-цистерны",
    description:
      "Для перевозки жидких и газообразных грузов: нефти, кислот, сжиженных газов.",
    image: "/pic/cisterna.png",
    price: "от 5 800 000 ₽",
  },
  {
    id: 8,
    title: "Ходовые части",
    description:
      "Тележки, колесные пары и литье для обеспечения надежного хода состава.",
    image: "/pic/hodovie.png",
    price: "от 800 000 ₽",
  },
];

const FAQ_ITEMS = [
  {
    question: "Как осуществляется доставка вагонов?",
    answer:
      "Доставка осуществляется по железнодорожным путям общего пользования в составе поездов или отдельными сцепами.",
  },
  {
    question: "Предоставляете ли вы лизинг?",
    answer:
      "Да, мы сотрудничаем с ведущими лизинговыми компаниями России и СНГ, предлагая льготные условия.",
  },
  {
    question: "Какие запасные части к грузовым вагонам вы поставляете?",
    answer:
      "Мы поставляем более 300 наименований запасных частей для грузовых вагонов собственного и партнёрского сертифицированного производства. Вся продукция изготавливается и поставляется в соответствии с ГОСТ и ТУ. В каталоге представлены колёсные пары и буксы, автосцепные устройства, тормозное оборудование, рамы и кузова, а также комплектующие и элементы ходовой части. По запросу подберём детали под конкретную модель вагона, рассчитаем стоимость и сроки поставки и подготовим коммерческое предложение.",
  },
  {
    question: "Каков срок службы ваших вагонов?",
    answer:
      "Нормативный срок службы составляет от 22 до 32 лет в зависимости от модели и условий эксплуатации.",
  },
  {
    question: "Возможно ли изготовление по индивидуальным чертежам?",
    answer:
      "Наше конструкторское бюро готово разработать спецвагоны под ваши уникальные логистические задачи.",
  },
];

// --- UI Elements ---
const chatWindow = document.getElementById("chat-window");
const chatMessages = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const initialInput = document.getElementById("initial-input");
const initialUI = document.getElementById("initial-ui");
const heroText = document.getElementById("hero-text");
const chatContainer = document.getElementById("chat-container");
const closeChatBtn = document.getElementById("close-chat");
const wagonTypesContainer = document.getElementById("wagon-types");
const catalogGrid = document.getElementById("catalog-grid");
const faqList = document.getElementById("faq-list");
const threeContainer = document.getElementById("three-container");

// --- Chat Logic ---
let currentSessionId = null;

// Expose functions globally for history sidebar
window.startNewChat = startNewChat;
window.loadSession = loadSession;

function toggleChat(active) {
  if (active) {
    chatWindow.classList.remove("hidden");
    initialUI.classList.add("hidden");
    heroText.classList.add("opacity-0");
    chatContainer.classList.remove("mb-8", "md:mb-12");
    chatContainer.classList.add("-mt-[100px]");
    const canvas = threeContainer.querySelector("canvas");
    if (canvas) canvas.classList.add("chat-active-blur");

    if (!currentSessionId && chatMessages.children.length <= 1) {
      // Ensure we have a session if we are typing
    }
  } else {
    chatWindow.classList.add("hidden");
    initialUI.classList.remove("hidden");
    heroText.classList.remove("opacity-0");
    chatContainer.classList.add("mb-8", "md:mb-12");
    chatContainer.classList.remove("-mt-[100px]");
    const canvas = threeContainer.querySelector("canvas");
    if (canvas) canvas.classList.remove("chat-active-blur");
  }
}

function addMessage(role, content, save = true) {
  const div = document.createElement("div");
  div.className = `flex gap-4 ${role === "user" ? "flex-row-reverse" : ""}`;
  div.innerHTML = `
    <div class="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm ${role === "ai" ? "bg-zinc-100 text-[#0FA47A] border border-black/10" : "bg-[#0FA47A] text-white"}">
        <i data-lucide="${role === "ai" ? "bot" : "user"}" class="w-4 h-4"></i>
    </div>
    <div class="chat-content max-w-[80%] p-4 rounded-[24px] text-xs md:text-sm leading-relaxed shadow-2xl ${role === "ai" ? "bg-white border border-black/10 text-zinc-900" : "bg-zinc-100 text-zinc-900"}">
        ${content}
    </div>
    `;
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  if (window.lucide) lucide.createIcons();

  if (save && currentSessionId) {
    saveMessageToHistory(currentSessionId, role, content);
  }
}

function startNewChat() {
  currentSessionId = null;
  chatMessages.innerHTML = `
        <div class="flex gap-4">
            <div class="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm bg-zinc-100 text-[#0FA47A] border border-black/10">
                <i data-lucide="bot" class="w-4 h-4"></i>
            </div>
            <div class="max-w-[80%] p-4 rounded-[24px] text-xs md:text-sm leading-relaxed shadow-2xl bg-white border border-black/10 text-zinc-900">
                Здравствуйте! Я ИИ-менеджер по продаже грузовых вагонов. Какие вагоны Вас интересуют?
            </div>
        </div>
    `;
  if (window.lucide) lucide.createIcons();
  toggleChat(true);
}

function loadSession(id) {
  const history = JSON.parse(
    localStorage.getItem("vagonai_chat_history") || "[]",
  );
  const session = history.find((s) => s.id === id);
  if (!session) return;

  currentSessionId = id;
  chatMessages.innerHTML = "";
  session.messages.forEach((msg) => {
    const role = msg.role === "assistant" ? "ai" : "user";
    addMessage(role, msg.content, false); // false = don't save again
  });
  toggleChat(true);
}

function saveMessageToHistory(sessionId, role, content) {
  const history = JSON.parse(
    localStorage.getItem("vagonai_chat_history") || "[]",
  );
  const sessionIndex = history.findIndex((s) => s.id === sessionId);
  if (sessionIndex !== -1) {
    // Save in format compatible with API (role: 'user' or 'assistant')
    const apiRole = role === "user" ? "user" : "assistant";
    history[sessionIndex].messages.push({
      role: apiRole,
      content,
      timestamp: Date.now(),
    });
    // Update title based on first user message
    if (
      history[sessionIndex].messages.filter((m) => m.role === "user").length ===
        1 &&
      role === "user"
    ) {
      history[sessionIndex].title =
        content.substring(0, 30) + (content.length > 30 ? "..." : "");
    }
    localStorage.setItem("vagonai_chat_history", JSON.stringify(history));
  }
}

async function processMessage(text) {
  if (!text.trim()) return;

  // Create session if needed (before adding message)
  if (!currentSessionId) {
    const id = Date.now().toString();
    const title = text.substring(0, 30) + (text.length > 30 ? "..." : "");
    const history = JSON.parse(
      localStorage.getItem("vagonai_chat_history") || "[]",
    );
    history.unshift({ id, title, messages: [], timestamp: Date.now() });
    localStorage.setItem("vagonai_chat_history", JSON.stringify(history));
    currentSessionId = id;
  }

  addMessage("user", text);
  chatInput.value = "";
  initialInput.value = "";

  // Show typing indicator
  const typingDiv = document.createElement("div");
  typingDiv.className = "flex gap-4";
  typingDiv.id = "typing-indicator";
  typingDiv.innerHTML = `
        <div class="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center shadow-sm bg-zinc-100 text-[#0FA47A] border border-black/10">
            <i data-lucide="bot" class="w-4 h-4"></i>
        </div>
        <div class="p-4 rounded-[24px] bg-white border border-black/10 text-zinc-500 text-xs italic">
            Печатает...
        </div>
    `;
  chatMessages.appendChild(typingDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  if (window.lucide) lucide.createIcons();

  try {
    const history = JSON.parse(
      localStorage.getItem("vagonai_chat_history") || "[]",
    );
    const session = history.find((s) => s.id === currentSessionId);
    const historyPayload = session
      ? session.messages.map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content,
        }))
      : [];

    const response = await fetch(
      "https://shumorusilu.beget.app/webhook/chat_vagon",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          chat_history: historyPayload,
        }),
      },
    );

    if (!response.ok) throw new Error("Network response was not ok");

    const data = await response.json();

    // Remove typing indicator
    const indicator = document.getElementById("typing-indicator");
    if (indicator) indicator.remove();

    // Check if data.answer exists (as in provided HTML)
    let aiText = "Извините, я не смог получить ответ.";
    if (data && data.answer) {
      aiText =
        typeof data.answer === "string"
          ? data.answer
          : JSON.stringify(data.answer);
    } else if (data && data.output) {
      // Fallback to output if answer doesn't exist
      aiText =
        typeof data.output === "string"
          ? data.output
          : JSON.stringify(data.output);
    }
    addMessage("ai", aiText);
  } catch (error) {
    console.error("Error:", error);
    const indicator = document.getElementById("typing-indicator");
    if (indicator) indicator.remove();
    addMessage("ai", "Произошла ошибка при подключении к ИИ.");
  }
}

// Event Listeners
if (initialInput) {
  initialInput.addEventListener("focus", () => toggleChat(true));
  initialInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      toggleChat(true);
      processMessage(initialInput.value);
    }
  });
}

if (chatInput) {
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") processMessage(chatInput.value);
  });
}

if (sendBtn) {
  sendBtn.addEventListener("click", () => processMessage(chatInput.value));
}

if (closeChatBtn) {
  closeChatBtn.addEventListener("click", () => toggleChat(false));
}

document.addEventListener("mousedown", (e) => {
  if (!chatWindow) return;
  const isHidden = chatWindow.classList.contains("hidden");
  if (isHidden) return;
  if (!chatWindow.contains(e.target)) {
    toggleChat(false);
  }
});

// Voice Input
const chatMicBtn = document.getElementById("chat-mic-btn");
const initialMicBtn = document.getElementById("initial-mic-btn");
function bindVoice(btn) {
  if (!btn) return;
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  btn.addEventListener("click", () => {
    if (!SpeechRecognition) {
      alert("Голосовой ввод недоступен в этом браузере. Разрешите микрофон или используйте современную версию.");
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "ru-RU";
      recognition.start();
      recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        if (chatWindow.classList.contains("hidden")) {
          if (initialInput) initialInput.value = text;
          toggleChat(true);
          processMessage(text);
        } else {
          if (chatInput) chatInput.value = text;
          processMessage(text);
        }
      };
    } catch (e) {
      console.error(e);
    }
  });
}
bindVoice(chatMicBtn);
bindVoice(initialMicBtn);

// Injection
if (wagonTypesContainer) {
  WAGON_TYPES.forEach((type) => {
    const btn = document.createElement("button");
    btn.className =
      "text-[9px] font-medium uppercase tracking-widest text-zinc-700 hover:text-[#0FA47A] transition-colors";
    btn.textContent = type;
    btn.onclick = () => {
      const text = `Расскажи про ${type}`;
      toggleChat(true);
      processMessage(text);
    };
    wagonTypesContainer.appendChild(btn);
  });
}

if (catalogGrid) {
  WAGON_CATALOG.forEach((item) => {
    const card = document.createElement("div");
    card.className =
      "group bg-white rounded-3xl border border-black/10 overflow-hidden shadow-2xl hover:shadow-[#0FA47A]/10 transition-all flex flex-col hover:-translate-y-2";
    card.innerHTML = `
        <div class="relative h-48 overflow-hidden">
            <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-80 group-hover:opacity-100">
            <div class="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent"></div>
        </div>
        <div class="p-6 flex flex-col flex-grow">
            <h3 class="text-lg font-bold mb-2 text-zinc-900">${item.title}</h3>
            <p class="text-zinc-700 text-sm mb-4 line-clamp-3 drop-shadow-sm flex-grow">${item.description}</p>
            <p class="text-zinc-900 text-sm font-bold mb-4">${item.price}</p>
            <button class="w-full py-3 bg-black/5 hover:bg-[#0FA47A] text-zinc-900 hover:text-white rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 border border-black/10 shadow-lg mt-auto">
                <i data-lucide="info" class="w-4 h-4"></i> Подробнее
            </button>
        </div>
        `;
    // Quick link fix: attach event listener to button
    const btn = card.querySelector("button");
    btn.onclick = () => {
      const text = `Хочу узнать подробнее про ${item.title}`;
      toggleChat(true);
      processMessage(text);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    catalogGrid.appendChild(card);
  });
}

if (faqList) {
  FAQ_ITEMS.forEach((item) => {
    const div = document.createElement("div");
    div.className =
      "bg-white rounded-2xl border border-black/10 overflow-hidden shadow-lg";
    div.innerHTML = `
        <button class="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-[#0FA47A]/5 transition-colors text-zinc-900">
            <span class="font-bold">${item.question}</span>
            <i data-lucide="chevron-down" class="w-5 h-5 transition-transform duration-300"></i>
        </button>
        <div class="max-h-0 overflow-hidden transition-all duration-300 ease-in-out">
            <div class="px-6 pb-5 text-zinc-700 text-sm border-t border-black/10 pt-4">${item.answer}</div>
        </div>
        `;
    const btn = div.querySelector("button");
    const content = div.querySelector("div");
    const icon = div.querySelector("i");
    btn.onclick = () => {
      const isOpen =
        content.style.maxHeight !== "0px" && content.style.maxHeight !== "";
      content.style.maxHeight = isOpen ? "0px" : content.scrollHeight + "px";
      icon.style.transform = isOpen ? "rotate(0deg)" : "rotate(180deg)";
    };
    faqList.appendChild(div);
  });
}

if (window.lucide) lucide.createIcons();
