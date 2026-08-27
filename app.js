/**
 * API Tester & Balance Checker
 * Built with Apple HIG & Emil Kowalski Design Engineering Principles
 */

(function () {
  'use strict';

  // --- State ---
  let selectedProvider = 'auto';
  let detectedProvider = null;
  let isTesting = false;
  let useProxy = false;
  let currentJsonResult = null;

  // --- DOM Elements ---
  const apiKeyInput = document.getElementById('apiKeyInput');
  const toggleMaskBtn = document.getElementById('toggleMaskBtn');
  const eyeIcon = document.getElementById('eyeIcon');
  const eyeOffIcon = document.getElementById('eyeOffIcon');
  const pasteBtn = document.getElementById('pasteBtn');
  const testBtn = document.getElementById('testBtn');
  const testBtnText = document.getElementById('testBtnText');
  const btnSpinner = document.getElementById('btnSpinner');
  const detectedBadge = document.getElementById('detectedBadge');
  const detectedProviderName = document.getElementById('detectedProviderName');
  const providerSelector = document.getElementById('providerSelector');
  const customConfigSection = document.getElementById('customConfigSection');
  const customMethod = document.getElementById('customMethod');
  const customUrl = document.getElementById('customUrl');
  const customAuthType = document.getElementById('customAuthType');

  // Result Elements
  const resultsSection = document.getElementById('resultsSection');
  const statusPulseDot = document.getElementById('statusPulseDot');
  const statusTitle = document.getElementById('statusTitle');
  const statusCodeBadge = document.getElementById('statusCodeBadge');
  const statusDescription = document.getElementById('statusDescription');
  const latencyValue = document.getElementById('latencyValue');
  const providerValue = document.getElementById('providerValue');

  // Balance Card
  const balanceCard = document.getElementById('balanceCard');
  const balanceMainAmount = document.getElementById('balanceMainAmount');
  const balanceSubtitle = document.getElementById('balanceSubtitle');
  const balanceExtraDetails = document.getElementById('balanceExtraDetails');
  const balanceMeterContainer = document.getElementById('balanceMeterContainer');
  const meterFill = document.getElementById('meterFill');
  const meterUsedLabel = document.getElementById('meterUsedLabel');
  const meterRemainingLabel = document.getElementById('meterRemainingLabel');

  // Details Card
  const detailsCard = document.getElementById('detailsCard');
  const detailsTitle = document.getElementById('detailsTitle');
  const detailsBadge = document.getElementById('detailsBadge');
  const detailsList = document.getElementById('detailsList');

  // Inspector
  const toggleInspectorBtn = document.getElementById('toggleInspectorBtn');
  const inspectorContent = document.getElementById('inspectorContent');
  const jsonCodeOutput = document.getElementById('jsonCodeOutput');
  const copyJsonBtn = document.getElementById('copyJsonBtn');

  // History & System
  const historyList = document.getElementById('historyList');
  const emptyHistoryState = document.getElementById('emptyHistoryState');
  const clearHistoryBtn = document.getElementById('clearHistoryBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const sunIcon = document.getElementById('sunIcon');
  const moonIcon = document.getElementById('moonIcon');
  const proxyToggleBtn = document.getElementById('proxyToggleBtn');
  const proxyStatusLabel = document.getElementById('proxyStatusLabel');
  const toastContainer = document.getElementById('toastContainer');

  // --- Provider Definitions ---
  const PROVIDERS = {
    openrouter: {
      name: 'OpenRouter',
      icon: '🌐',
      supportsBalance: true,
      detect: (k) => /^sk-or-v1-[a-f0-9]{32,}/i.test(k) || k.startsWith('sk-or-'),
      buildRequest: (key) => ({
        url: 'https://openrouter.ai/api/v1/auth/key',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${key}`
        }
      }),
      parseResponse: (data) => {
        if (!data || !data.data) return null;
        const d = data.data;
        const usage = typeof d.usage === 'number' ? d.usage : 0;
        const limit = typeof d.limit === 'number' ? d.limit : null;
        const remaining = limit !== null ? Math.max(0, limit - usage) : null;
        const isFree = d.is_free_tier;

        return {
          hasBalance: true,
          mainAmount: remaining !== null ? `$${remaining.toFixed(2)} USD` : (limit === null ? 'Ilimitado' : 'Disponível'),
          subtitle: `Créditos restantes ${isFree ? '• Nível Gratuito' : '• Conta Paga'}`,
          stats: [
            { label: 'Uso total', value: `$${usage.toFixed(4)} USD` },
            { label: 'Limite configurado', value: limit !== null ? `$${limit.toFixed(2)} USD` : 'Sem limite' },
            { label: 'Nome da chave', value: d.label || 'Principal' }
          ],
          meter: limit && limit > 0 ? {
            percent: Math.min(100, (usage / limit) * 100),
            used: `Uso: $${usage.toFixed(2)}`,
            remaining: `Restante: $${remaining.toFixed(2)}`
          } : null,
          detailsTitle: 'Limites de Taxa',
          items: d.rate_limit ? [
            `${d.rate_limit.requests} requisições por ${d.rate_limit.interval}`,
            isFree ? 'Free Tier' : 'Pay-as-you-go'
          ] : ['Chave autorizada para uso imediato']
        };
      }
    },

    deepseek: {
      name: 'DeepSeek',
      icon: '🐳',
      supportsBalance: true,
      detect: (k) => (k.startsWith('sk-') && k.length === 35),
      buildRequest: (key) => ({
        url: 'https://api.deepseek.com/user/balance',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${key}`
        }
      }),
      parseResponse: (data) => {
        if (!data || !data.balance_infos || !data.balance_infos.length) return null;
        const info = data.balance_infos[0];
        const total = parseFloat(info.total_balance) || 0;
        const granted = parseFloat(info.granted_balance) || 0;
        const toppedUp = parseFloat(info.topped_up_balance) || 0;
        const currency = info.currency || 'USD';

        return {
          hasBalance: true,
          mainAmount: `${currency === 'USD' ? '$' : '¥'}${total.toFixed(2)} ${currency}`,
          subtitle: data.is_available ? 'Saldo disponível para inferência' : 'Saldo indisponível',
          stats: [
            { label: 'Saldo Recarregado', value: `${toppedUp.toFixed(2)} ${currency}` },
            { label: 'Créditos Bônus/Gratuitos', value: `${granted.toFixed(2)} ${currency}` },
            { label: 'Disponibilidade', value: data.is_available ? 'Ativa' : 'Bloqueada' }
          ],
          meter: null,
          detailsTitle: 'Informações da Conta',
          items: [
            `Moeda: ${currency}`,
            `Status: ${data.is_available ? 'Pronta para chamadas' : 'Sem saldo disponível'}`
          ]
        };
      }
    },

    elevenlabs: {
      name: 'ElevenLabs',
      icon: '🎙️',
      supportsBalance: true,
      detect: (k) => (k.startsWith('xi_') || (k.length === 32 && /^[a-f0-9]{32}$/i.test(k))),
      buildRequest: (key) => ({
        url: 'https://api.elevenlabs.io/v1/user/subscription',
        method: 'GET',
        headers: {
          'xi-api-key': key
        }
      }),
      parseResponse: (data) => {
        if (!data || typeof data.character_count !== 'number') return null;
        const used = data.character_count || 0;
        const limit = data.character_limit || 0;
        const remaining = Math.max(0, limit - used);
        const percentUsed = limit > 0 ? (used / limit) * 100 : 0;

        return {
          hasBalance: true,
          mainAmount: `${remaining.toLocaleString('pt-BR')} chars`,
          subtitle: `Caracteres restantes no ciclo (${data.tier || 'Plano'})`,
          stats: [
            { label: 'Utilizados', value: `${used.toLocaleString('pt-BR')} chars` },
            { label: 'Limite Total', value: `${limit.toLocaleString('pt-BR')} chars` },
            { label: 'Status da Assinatura', value: data.status || 'Ativo' }
          ],
          meter: {
            percent: percentUsed,
            used: `Usado: ${used.toLocaleString('pt-BR')}`,
            remaining: `Restante: ${remaining.toLocaleString('pt-BR')}`
          },
          detailsTitle: 'Detalhes do Plano',
          items: [
            `Plano: ${data.tier || 'Free'}`,
            `Status: ${data.status || 'Active'}`,
            data.can_extend_character_limit ? 'Extensão de limite permitida' : 'Limite fixo'
          ]
        };
      }
    },

    github: {
      name: 'GitHub PAT',
      icon: '🐙',
      supportsBalance: true,
      detect: (k) => /^(ghp|github_pat|gho)_[a-zA-Z0-9_]{20,}/.test(k),
      buildRequest: (key) => ({
        url: 'https://api.github.com/rate_limit',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Accept': 'application/vnd.github+json'
        }
      }),
      parseResponse: (data) => {
        if (!data || !data.resources || !data.resources.core) return null;
        const core = data.resources.core;
        const used = core.limit - core.remaining;
        const percent = core.limit > 0 ? (used / core.limit) * 100 : 0;
        const resetDate = new Date(core.reset * 1000);
        const minutesToReset = Math.max(0, Math.round((resetDate - new Date()) / 60000));

        return {
          hasBalance: true,
          mainAmount: `${core.remaining.toLocaleString('pt-BR')} / ${core.limit.toLocaleString('pt-BR')}`,
          subtitle: 'Requisições restantes na cota da API',
          stats: [
            { label: 'Requisições Usadas', value: used.toLocaleString('pt-BR') },
            { label: 'Reset da Cota', value: `em ~${minutesToReset} min` },
            { label: 'Cota GraphQL', value: `${data.resources.graphql?.remaining || 0}` }
          ],
          meter: {
            percent: percent,
            used: `Usado: ${used}`,
            remaining: `Restante: ${core.remaining}`
          },
          detailsTitle: 'Recursos Autorizados',
          items: [
            `Core: ${core.remaining} reqs`,
            `Search: ${data.resources.search?.remaining || 0} reqs`,
            `GraphQL: ${data.resources.graphql?.remaining || 0} reqs`
          ]
        };
      }
    },

    openai: {
      name: 'OpenAI',
      icon: '🤖',
      supportsBalance: false,
      detect: (k) => /^sk-(proj-)?[a-zA-Z0-9_-]{30,}/.test(k),
      buildRequest: (key) => ({
        url: 'https://api.openai.com/v1/models',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${key}`
        }
      }),
      parseResponse: (data) => {
        if (!data || !Array.isArray(data.data)) return null;
        const models = data.data.map(m => m.id);
        const topModels = models.filter(m => m.includes('gpt') || m.includes('o1') || m.includes('dall-e')).slice(0, 10);

        return {
          hasBalance: false,
          detailsTitle: `Modelos Disponíveis (${models.length})`,
          items: topModels.length > 0 ? topModels : models.slice(0, 8)
        };
      }
    },

    gemini: {
      name: 'Google Gemini',
      icon: '✨',
      supportsBalance: false,
      detect: (k) => /^AIzaSy[a-zA-Z0-9_-]{33}/.test(k),
      buildRequest: (key) => ({
        url: `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
        method: 'GET',
        headers: {}
      }),
      parseResponse: (data) => {
        if (!data || !Array.isArray(data.models)) return null;
        const models = data.models.map(m => m.displayName || m.name.replace('models/', ''));
        return {
          hasBalance: false,
          detailsTitle: `Modelos Gemini Habilitados (${data.models.length})`,
          items: models.slice(0, 8)
        };
      }
    },

    anthropic: {
      name: 'Anthropic Claude',
      icon: '🧠',
      supportsBalance: false,
      detect: (k) => /^sk-ant-[a-zA-Z0-9_-]{20,}/.test(k),
      buildRequest: (key) => ({
        url: 'https://api.anthropic.com/v1/messages',
        method: 'POST',
        headers: {
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }]
        })
      }),
      parseResponse: (data) => {
        if (!data) return null;
        return {
          hasBalance: false,
          detailsTitle: 'Status Claude',
          items: [
            `Modelo testado: ${data.model || 'claude-3-haiku'}`,
            `Tokens de saída: ${data.usage?.output_tokens || 1}`,
            'Chave ativa e pronta para inferência'
          ]
        };
      }
    },

    groq: {
      name: 'Groq Cloud',
      icon: '⚡',
      supportsBalance: false,
      detect: (k) => /^gsk_[a-zA-Z0-9]{20,}/.test(k),
      buildRequest: (key) => ({
        url: 'https://api.groq.com/openai/v1/models',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${key}`
        }
      }),
      parseResponse: (data) => {
        if (!data || !Array.isArray(data.data)) return null;
        const models = data.data.map(m => m.id);
        return {
          hasBalance: false,
          detailsTitle: `Modelos de Ultra-Baixa Latência (${models.length})`,
          items: models.slice(0, 8)
        };
      }
    },

    custom: {
      name: 'Custom REST API',
      icon: '⚙️',
      supportsBalance: false,
      detect: () => false,
      buildRequest: (key) => {
        const url = customUrl.value.trim();
        const method = customMethod.value;
        const auth = customAuthType.value;
        const headers = { 'Accept': 'application/json' };
        let finalUrl = url;

        if (key) {
          if (auth === 'bearer') headers['Authorization'] = `Bearer ${key}`;
          else if (auth === 'apikey') headers['X-API-Key'] = key;
          else if (auth === 'token') headers['Authorization'] = `token ${key}`;
          else if (auth === 'query') {
            const separator = finalUrl.includes('?') ? '&' : '?';
            finalUrl += `${separator}api_key=${encodeURIComponent(key)}`;
          }
        }

        return { url: finalUrl, method, headers };
      },
      parseResponse: (data) => {
        const keys = typeof data === 'object' && data !== null ? Object.keys(data) : [];
        return {
          hasBalance: false,
          detailsTitle: 'Propriedades da Resposta',
          items: keys.length > 0 ? keys.slice(0, 8).map(k => `Campo: ${k}`) : ['Resposta recebida com sucesso']
        };
      }
    }
  };

  // --- Auto-Detection ---
  function detectProviderFromKey(key) {
    const trimmed = key.trim();
    if (!trimmed) return null;

    for (const [id, prov] of Object.entries(PROVIDERS)) {
      if (id === 'custom') continue;
      if (prov.detect && prov.detect(trimmed)) {
        return id;
      }
    }
    return null;
  }

  function updateAutoDetectionUI() {
    const key = apiKeyInput.value.trim();
    const detected = detectProviderFromKey(key);
    detectedProvider = detected;

    if (detected && PROVIDERS[detected]) {
      detectedProviderName.textContent = PROVIDERS[detected].name;
      detectedBadge.classList.remove('hidden');

      if (selectedProvider === 'auto') {
        highlightActivePill(detected, true);
      }
    } else {
      detectedBadge.classList.add('hidden');
      if (selectedProvider === 'auto') {
        highlightActivePill('auto', false);
      }
    }
  }

  function highlightActivePill(providerId, isAutoDetected = false) {
    const pills = providerSelector.querySelectorAll('.provider-pill');
    pills.forEach(pill => {
      const p = pill.dataset.provider;
      if (p === providerId || (selectedProvider === 'auto' && p === 'auto' && !isAutoDetected)) {
        pill.classList.add('active');
        pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        pill.classList.remove('active');
      }
    });
  }

  // --- UI Event Handlers ---
  function setupEventListeners() {
    apiKeyInput.addEventListener('input', updateAutoDetectionUI);

    toggleMaskBtn.addEventListener('click', () => {
      const isPassword = apiKeyInput.type === 'password';
      apiKeyInput.type = isPassword ? 'text' : 'password';
      eyeIcon.classList.toggle('hidden', isPassword);
      eyeOffIcon.classList.toggle('hidden', !isPassword);
    });

    pasteBtn.addEventListener('click', async () => {
      try {
        const text = await navigator.clipboard.readText();
        if (text) {
          apiKeyInput.value = text.trim();
          updateAutoDetectionUI();
          showToast('Chave colada com sucesso!', 'success', '📋');
          apiKeyInput.focus();
        }
      } catch (err) {
        showToast('Permissão de leitura negada. Use Ctrl+V.', 'warning', '⚠️');
      }
    });

    providerSelector.addEventListener('click', (e) => {
      const pill = e.target.closest('.provider-pill');
      if (!pill) return;

      const prov = pill.dataset.provider;
      selectedProvider = prov;

      const pills = providerSelector.querySelectorAll('.provider-pill');
      pills.forEach(p => p.classList.toggle('active', p === pill));

      if (prov === 'custom') {
        customConfigSection.classList.remove('hidden');
      } else {
        customConfigSection.classList.add('hidden');
      }

      if (prov === 'auto') {
        updateAutoDetectionUI();
      }
    });

    testBtn.addEventListener('click', runApiTest);

    apiKeyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !isTesting) {
        runApiTest();
      }
    });

    toggleInspectorBtn.addEventListener('click', () => {
      const isHidden = inspectorContent.classList.contains('hidden');
      inspectorContent.classList.toggle('hidden', !isHidden);
      toggleInspectorBtn.classList.toggle('open', isHidden);
    });

    copyJsonBtn.addEventListener('click', () => {
      if (!currentJsonResult) return;
      navigator.clipboard.writeText(JSON.stringify(currentJsonResult, null, 2));
      showToast('JSON copiado para a área de transferência!', 'success', '📋');
    });

    clearHistoryBtn.addEventListener('click', () => {
      localStorage.removeItem('api_tester_history');
      renderHistory();
      showToast('Histórico apagado.', 'info', '🗑️');
    });

    themeToggleBtn.addEventListener('click', toggleTheme);

    proxyToggleBtn.addEventListener('click', () => {
      useProxy = !useProxy;
      updateProxyStatusUI();
      showToast(
        useProxy ? 'Proxy CORS ativado (útil se o navegador bloquear requisições diretas)' : 'Modo direto reativado',
        'info',
        '⚡'
      );
    });
  }

  // --- Theme Management ---
  function initTheme() {
    const saved = localStorage.getItem('api_tester_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    applyTheme(theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const isDark = theme === 'dark';
    sunIcon.classList.toggle('hidden', !isDark);
    moonIcon.classList.toggle('hidden', isDark);
    localStorage.setItem('api_tester_theme', theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
  }

  function updateProxyStatusUI() {
    proxyToggleBtn.classList.toggle('active', useProxy);
    proxyStatusLabel.textContent = useProxy ? 'Proxy: Ativo' : 'Proxy: Desativado';
  }

  // --- API Testing Engine ---
  async function runApiTest() {
    const key = apiKeyInput.value.trim();

    let targetProviderId = selectedProvider;
    if (targetProviderId === 'auto') {
      targetProviderId = detectedProvider || 'openai';
    }

    if (!key && targetProviderId !== 'custom') {
      showToast('Por favor, insira uma chave de API antes de testar.', 'warning', '⚠️');
      apiKeyInput.focus();
      return;
    }

    const providerDef = PROVIDERS[targetProviderId];
    if (!providerDef) {
      showToast('Provedor não suportado.', 'danger', '❌');
      return;
    }

    if (targetProviderId === 'custom' && !customUrl.value.trim()) {
      showToast('Insira a URL do Endpoint customizado.', 'warning', '⚠️');
      customUrl.focus();
      return;
    }

    setLoading(true);
    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    statusPulseDot.className = 'status-dot';
    statusTitle.textContent = 'Conectando...';
    statusCodeBadge.textContent = 'HTTP ---';
    statusDescription.textContent = `Enviando requisição de teste para ${providerDef.name}...`;
    latencyValue.textContent = '-- ms';
    providerValue.textContent = providerDef.name;
    balanceCard.classList.add('hidden');
    detailsCard.classList.add('hidden');
    inspectorContent.classList.add('hidden');
    toggleInspectorBtn.classList.remove('open');

    const startTime = performance.now();
    let res = null;
    let responseData = null;
    let latency = 0;
    let isCorsError = false;

    try {
      const reqConfig = providerDef.buildRequest(key);
      let targetUrl = reqConfig.url;

      if (useProxy) {
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          targetUrl = `/api/proxy?url=${encodeURIComponent(targetUrl)}`;
        } else {
          targetUrl = `https://corsproxy.io/?url=${encodeURIComponent(targetUrl)}`;
        }
      }

      const fetchOptions = {
        method: reqConfig.method || 'GET',
        headers: reqConfig.headers || {}
      };

      if (reqConfig.body) {
        fetchOptions.body = reqConfig.body;
      }

      res = await fetch(targetUrl, fetchOptions);
      latency = Math.round(performance.now() - startTime);

      const text = await res.text();
      try {
        responseData = JSON.parse(text);
      } catch (e) {
        responseData = { rawResponse: text };
      }
    } catch (err) {
      latency = Math.round(performance.now() - startTime);
      isCorsError = true;
      responseData = {
        error: err.name,
        message: err.message,
        hint: 'Possível bloqueio de CORS do navegador ou falha de conexão.'
      };
    }

    setLoading(false);
    currentJsonResult = responseData;
    jsonCodeOutput.textContent = JSON.stringify(responseData, null, 2);

    handleTestResults({
      providerId: targetProviderId,
      providerDef,
      res,
      data: responseData,
      latency,
      isCorsError,
      key
    });
  }

  function handleTestResults({ providerId, providerDef, res, data, latency, isCorsError, key }) {
    latencyValue.textContent = `${latency} ms`;

    if (isCorsError || !res) {
      statusPulseDot.className = 'status-dot warning';
      statusTitle.textContent = 'Bloqueio de CORS / Rede';
      statusCodeBadge.textContent = 'Erro';
      statusDescription.textContent = 'O navegador bloqueou a requisição direta por política de CORS. Ative o "Proxy" no topo da tela para contornar.';
      showToast('Bloqueio CORS detectado. Clique em "Proxy" para contornar!', 'warning', '🛡️');

      saveHistoryItem({
        provider: providerDef.name,
        key,
        status: 'warning',
        statusCode: 'CORS',
        latency,
        providerId
      });
      return;
    }

    const status = res.status;
    statusCodeBadge.textContent = `HTTP ${status}`;

    if (res.ok) {
      statusPulseDot.className = 'status-dot success';
      statusTitle.textContent = 'API Ativa & Funcionando';
      statusDescription.textContent = `A chave é válida e está pronta para uso imediato em ${providerDef.name}.`;
      showToast(`${providerDef.name}: Chave validada com sucesso!`, 'success', '✅');

      if (providerDef.parseResponse) {
        const parsed = providerDef.parseResponse(data);
        if (parsed) {
          if (parsed.hasBalance) {
            balanceMainAmount.textContent = parsed.mainAmount;
            balanceSubtitle.textContent = parsed.subtitle;
            
            balanceExtraDetails.innerHTML = '';
            if (parsed.stats) {
              parsed.stats.forEach(st => {
                const item = document.createElement('div');
                item.className = 'stat-item';
                item.innerHTML = `${st.label}: <strong>${st.value}</strong>`;
                balanceExtraDetails.appendChild(item);
              });
            }

            if (parsed.meter) {
              balanceMeterContainer.classList.remove('hidden');
              meterFill.style.width = `${Math.min(100, parsed.meter.percent)}%`;
              meterUsedLabel.textContent = parsed.meter.used;
              meterRemainingLabel.textContent = parsed.meter.remaining;
            } else {
              balanceMeterContainer.classList.add('hidden');
            }

            balanceCard.classList.remove('hidden');
          }

          if (parsed.items && parsed.items.length > 0) {
            detailsTitle.textContent = parsed.detailsTitle || 'Recursos Disponíveis';
            detailsBadge.textContent = `${parsed.items.length} itens`;
            detailsList.innerHTML = '';
            parsed.items.forEach(it => {
              const chip = document.createElement('span');
              chip.className = 'detail-chip';
              chip.textContent = it;
              detailsList.appendChild(chip);
            });
            detailsCard.classList.remove('hidden');
          }
        }
      }

      saveHistoryItem({
        provider: providerDef.name,
        key,
        status: 'success',
        statusCode: status,
        latency,
        providerId
      });
      return;
    }

    if (status === 429) {
      statusPulseDot.className = 'status-dot warning';
      statusTitle.textContent = 'Sem Saldo / Cota Esgotada';
      statusDescription.textContent = 'A chave é autêntica, porém os créditos acabaram ou o limite de requisições por minuto foi atingido.';
      showToast('Cota ou créditos esgotados na API (HTTP 429).', 'warning', '⚠️');

      saveHistoryItem({
        provider: providerDef.name,
        key,
        status: 'warning',
        statusCode: 429,
        latency,
        providerId
      });
      return;
    }

    if (status === 401 || status === 403) {
      statusPulseDot.className = 'status-dot danger';
      statusTitle.textContent = 'Chave Inválida ou Revogada';
      statusDescription.textContent = 'A API rejeitou as credenciais fornecidas. Verifique se a chave está digitada corretamente ou foi revogada.';
      showToast('Chave de API inválida ou não autorizada (HTTP 401).', 'danger', '❌');

      saveHistoryItem({
        provider: providerDef.name,
        key,
        status: 'danger',
        statusCode: status,
        latency,
        providerId
      });
      return;
    }

    statusPulseDot.className = 'status-dot danger';
    statusTitle.textContent = `Aviso do Provedor (HTTP ${status})`;
    statusDescription.textContent = (data && data.error && (data.error.message || data.error)) 
      ? String(data.error.message || data.error) 
      : 'A API retornou uma resposta inesperada. Verifique os detalhes no JSON abaixo.';
    
    saveHistoryItem({
      provider: providerDef.name,
      key,
      status: 'danger',
      statusCode: status,
      latency,
      providerId
    });
  }

  function setLoading(loading) {
    isTesting = loading;
    testBtn.disabled = loading;
    btnSpinner.classList.toggle('hidden', !loading);
    testBtnText.textContent = loading ? 'Verificando...' : 'Testar API';
  }

  // --- History System ---
  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem('api_tester_history')) || [];
    } catch (e) {
      return [];
    }
  }

  function saveHistoryItem(item) {
    const history = getHistory();
    const maskedKey = maskKey(item.key);
    
    const entry = {
      id: Date.now(),
      provider: item.provider,
      providerId: item.providerId,
      maskedKey,
      rawKey: item.key,
      status: item.status,
      statusCode: item.statusCode,
      latency: item.latency,
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };

    const filtered = history.filter(h => h.rawKey !== item.key);
    filtered.unshift(entry);
    localStorage.setItem('api_tester_history', JSON.stringify(filtered.slice(0, 10)));
    renderHistory();
  }

  function renderHistory() {
    const history = getHistory();
    historyList.innerHTML = '';

    if (history.length === 0) {
      emptyHistoryState.classList.remove('hidden');
      clearHistoryBtn.classList.add('hidden');
      return;
    }

    emptyHistoryState.classList.add('hidden');
    clearHistoryBtn.classList.remove('hidden');

    history.forEach(item => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.innerHTML = `
        <div class="history-item-left">
          <div class="history-status-indicator status-dot ${item.status}"></div>
          <div class="history-info">
            <div class="history-provider">
              <span>${item.provider}</span>
              <span class="status-code-badge">${item.statusCode}</span>
            </div>
            <span class="history-key-masked">${item.maskedKey}</span>
          </div>
        </div>
        <div class="history-item-right">
          <div class="history-meta">
            <span class="history-latency">${item.latency} ms</span>
            <span class="history-time">${item.timestamp}</span>
          </div>
          <button class="retest-btn" data-key="${item.rawKey}" data-provider="${item.providerId}">
            Retestar
          </button>
        </div>
      `;

      const retestBtn = el.querySelector('.retest-btn');
      retestBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        apiKeyInput.value = item.rawKey;
        selectedProvider = item.providerId || 'auto';
        highlightActivePill(selectedProvider);
        updateAutoDetectionUI();
        runApiTest();
      });

      el.addEventListener('click', () => {
        apiKeyInput.value = item.rawKey;
        selectedProvider = item.providerId || 'auto';
        highlightActivePill(selectedProvider);
        updateAutoDetectionUI();
        showToast('Chave restaurada do histórico.', 'info', '↩️');
      });

      historyList.appendChild(el);
    });
  }

  function maskKey(key) {
    if (!key) return '';
    if (key.length <= 10) return key.slice(0, 3) + '***' + key.slice(-2);
    return key.slice(0, 7) + '••••••••' + key.slice(-4);
  }

  // --- Sonner-Style Toast Notifications ---
  function showToast(message, type = 'info', icon = 'ℹ️') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${message}</span>
    `;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('removing');
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 200);
    }, 3200);
  }

  // --- Initialization ---
  function init() {
    initTheme();
    setupEventListeners();
    renderHistory();
    updateProxyStatusUI();

    if (apiKeyInput.value) {
      updateAutoDetectionUI();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
