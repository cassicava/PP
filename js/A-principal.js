const dirtyForms = {
    turnos: false,
    cargos: false,
    funcionarios: false,
    equipes: false,
    'gerar-escala': false,
};

let isNavigating = false;
let statusHojeInterval = null;

const PROGRESS_STEPS = [
    { 
        level: 1, 
        title: 'Vamos começar!', 
        description: 'O primeiro passo é definir os horários de trabalho da sua operação. Crie um turno para começar.',
        unlockText: '🔓 Desbloqueia: Cargos',
        percent: 0 
    },
    { 
        level: 2, 
        title: 'Ótimo começo!', 
        description: 'Agora precisamos criar as funções ou postos de trabalho. Cadastre pelo menos um Cargo e associe o turno que você criou.',
        unlockText: '🔓 Desbloqueia: Funcionários',
        percent: 25 
    },
    { 
        level: 3, 
        title: 'Cadastre seus Funcionários', 
        description: 'Agora é hora de registrar quem trabalha com você. Cadastre seus colaboradores, defina o cargo e a disponibilidade.',
        unlockText: '🔓 Desbloqueia: Gerar Escala',
        percent: 50 
    },
    { 
        level: 4, 
        title: 'Tudo pronto para a mágica', 
        description: 'Você já tem o essencial. Use o Assistente de Geração para criar sua primeira escala automática.',
        unlockText: '🔓 Desbloqueia: Relatórios e Análises',
        percent: 75 
    },
    { 
        level: 5, 
        title: 'Parabéns! Configuração Concluída 🚀', 
        description: 'Você dominou o básico! Agora você pode gerenciar suas escalas, ver relatórios e muito mais. Lembre-se: os botões de 💡 Ajuda estão disponíveis em cada tela se precisar.',
        unlockText: '',
        percent: 100 
    }
];

const PAGE_ACCESS_LEVEL = {
    'home': 1,
    'configuracoes': 1,
    'turnos': 1,
    'cargos': 2,
    'funcionarios': 3,
    'equipes': 3,
    'gerar-escala': 4,
    'escalas-salvas': 5,
    'relatorios': 5
};

function getCurrentDataLevel() {
    const { turnos, cargos, funcionarios, escalas } = store.getState();
    const hasTurnos = turnos.filter(t => !t.isSystem && t.status === 'ativo').length > 0;
    const hasCargos = cargos.filter(c => c.status === 'ativo').length > 0;
    const hasFuncs = funcionarios.filter(f => f.status === 'ativo').length > 0;
    const hasEscalas = escalas.length > 0;

    if (hasEscalas) return 5;
    if (hasFuncs) return 4;
    if (hasCargos) return 3;
    if (hasTurnos) return 2;
    return 1;
}

function getEffectiveLevel() {
    const dataLevel = getCurrentDataLevel();
    const savedLevel = parseInt(localStorage.getItem('ge_unlock_level') || '1', 10);
    const finalLevel = Math.max(dataLevel, savedLevel);
    
    if (finalLevel > savedLevel) {
        localStorage.setItem('ge_unlock_level', finalLevel.toString());
        if(finalLevel < 5) {
            setTimeout(() => {
                showToast(`🎉 Passo concluído! Próxima etapa desbloqueada.`, 'success');
            }, 500);
        }
    }
    return finalLevel;
}

function dismissTutorial() {
    localStorage.setItem('ge_tutorial_dismissed', 'true');
    const panel = $("#home-progress-section");
    if(panel) {
        panel.style.opacity = '0';
        setTimeout(() => panel.style.display = 'none', 300);
    }
}

function updateUnlockUI() {
    const currentLevel = getEffectiveLevel();
    const stepInfo = PROGRESS_STEPS.find(s => s.level === currentLevel) || PROGRESS_STEPS[0];
    const isDismissed = localStorage.getItem('ge_tutorial_dismissed') === 'true';
    const progressSection = $("#home-progress-section");
    
    if (progressSection) {
        if (isDismissed) {
            progressSection.style.display = 'none';
        } else {
            progressSection.style.display = 'flex';
            const contentHTML = `
                <div class="home-progress-info">
                    <div class="home-progress-header">
                        <div class="home-progress-title">
                            ${currentLevel === 5 ? '🌟' : '📍'} ${stepInfo.title}
                        </div>
                        <div class="home-progress-subtitle">
                            ${stepInfo.description}
                        </div>
                        ${stepInfo.unlockText ? `<div class="home-progress-unlock-badge">${stepInfo.unlockText}</div>` : ''}
                    </div>
                </div>
                <div class="home-progress-visual">
                    ${currentLevel < 5 ? `
                    <div class="home-progress-bar-container">
                        <div id="home-progress-bar" class="home-progress-bar-fill" style="width: ${stepInfo.percent}%"></div>
                        <span id="home-progress-percent" class="home-progress-text">${stepInfo.percent}%</span>
                    </div>` : `
                    <button class="tutorial-close-btn" onclick="dismissTutorial()">👋 Tchau</button>
                    `}
                </div>
            `;
            progressSection.innerHTML = contentHTML;
            if(currentLevel === 5) {
                progressSection.classList.add('completed');
            }
            parseEmojisInElement(progressSection);
        }
    }

    $$(".tab-btn").forEach(btn => {
        const page = btn.dataset.page;
        const requiredLevel = PAGE_ACCESS_LEVEL[page] || 1;
        const isLocked = currentLevel < requiredLevel;
        if (isLocked) {
            btn.classList.add('locked');
            btn.title = "Complete a etapa anterior para desbloquear.";
        } else {
            btn.classList.remove('locked');
            btn.title = "";
        }
        void btn.offsetWidth; 
    });

    $$(".home-card-wrapper").forEach(wrapper => {
        const link = wrapper.querySelector('.home-card');
        if (link) {
            const page = link.dataset.goto;
            const requiredLevel = PAGE_ACCESS_LEVEL[page] || 1;
            const isLocked = currentLevel < requiredLevel;
            if (isLocked) {
                wrapper.classList.add('locked');
            } else {
                wrapper.classList.remove('locked');
            }
            void wrapper.offsetWidth;
        }
    });
}

async function handleDataCorruptionError() {
    const splashScreen = $("#splash-screen");
    if (splashScreen) {
        splashScreen.style.display = 'none';
    }

    const action = await showActionModal({
        title: "🚨 Erro ao Carregar Dados",
        message: "Não foi possível carregar suas informações. O arquivo de dados pode estar corrompido, possivelmente devido a um desligamento inesperado ou limpeza de cache. O que você gostaria de fazer?",
        columnLayout: true,
        actions: [
            { id: 'import', text: '📥 Importar um Backup', class: 'primary' },
            { id: 'reset', text: '🔥 Apagar Dados e Recomeçar', class: 'danger' },
        ]
    });

    if (action === 'import') {
        importAllData();
    } else if (action === 'reset') {
        const { confirmed } = await showConfirm({
            title: "Tem Certeza?",
            message: "Isso apagará todos os dados corrompidos e iniciará o aplicativo do zero. Esta ação não pode ser desfeita.",
            confirmText: "Sim, Apagar Tudo"
        });
        if (confirmed) {
            await performHardReset();
        }
    }
}

function updateWelcomeMessage() {
    const welcomeEl = $("#welcomeTitle");
    if (!welcomeEl) return;
    const { config } = store.getState();
    const nome = config.nome;
    welcomeEl.textContent = (nome && nome.trim() !== '') ? `${nome}!` : `Bem-vindo!`;
}

function getTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function universalDateNormalize(dateVal) {
    if (!dateVal) return '';
    try {
        const str = String(dateVal).trim();
        
        const isoMatch = str.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (isoMatch) {
            return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
        }
        
        const brMatch = str.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (brMatch) {
            return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`;
        }
        
        if (!isNaN(Number(str)) && str.length > 10) {
            const d = new Date(Number(str));
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }
        
        return str.split('T')[0];
    } catch (e) {
        return String(dateVal).split('T')[0];
    }
}

function updateTimelineProgress() {
    const now = new Date();
    let currentMinutes = (now.getHours() * 60) + now.getMinutes();
    const progressEl = $("#status-hoje-progress");
    
    if (progressEl) {
        const minStart = parseInt(progressEl.dataset.min) || 0;
        const timelineEnd = parseInt(progressEl.dataset.max) || 1440;
        const range = timelineEnd - minStart || 1;

        let percent = ((currentMinutes - minStart) / range) * 100;
        percent = Math.max(0, Math.min(100, percent));
        progressEl.style.width = `${percent}%`;
    }

    $$('.shift-block').forEach(block => {
        const startMin = parseInt(block.dataset.start);
        const endMin = parseInt(block.dataset.end);
        let checkMinutes = currentMinutes;
        
        if (checkMinutes < startMin && endMin > 1440 && (checkMinutes + 1440) <= endMin) {
            checkMinutes += 1440;
        }
        
        const isActive = checkMinutes >= startMin && checkMinutes <= endMin;

        if (isActive) {
            block.classList.add('active-shift');
        } else {
            block.classList.remove('active-shift');
        }
    });
}

function renderShiftsForCargo(cargoId, escalasHoje, today) {
    const { turnos, funcionarios } = store.getState();
    const shiftsContainer = $("#status-hoje-shifts");
    if (!shiftsContainer) return;

    shiftsContainer.innerHTML = '';

    const cargoIdStr = String(cargoId);
    const escalasDoCargo = escalasHoje.filter(e => String(e.cargoId) === cargoIdStr);
    
    if (escalasDoCargo.length === 0) return;

    let slotsHoje = [];
    const normToday = universalDateNormalize(today);

    escalasDoCargo.forEach(escala => {
        if (escala.slots && Array.isArray(escala.slots)) {
            const slots = escala.slots.filter(s => {
                const dateVal = s.date || s.data || s.dia || s.start || s.inicio;
                const turnoVal = s.turnoId || s.idTurno || s.turno_id || s.turno;
                const funcVal = s.funcionarioId || s.idFuncionario || s.funcionario_id || s.funcionario || s.assigned; 
                
                if (!dateVal || !turnoVal || !funcVal) return false;
                
                const slotDateNorm = universalDateNormalize(dateVal);
                const isSameDate = slotDateNorm === normToday;
                const isWorkingShift = !String(turnoVal).includes('system_id');
                
                return isSameDate && isWorkingShift;
            });
            
            const mappedSlots = slots.map(s => ({
                date: s.date || s.data || s.dia || s.start || s.inicio,
                turnoId: s.turnoId || s.idTurno || s.turno_id || s.turno,
                funcionarioId: s.funcionarioId || s.idFuncionario || s.funcionario_id || s.funcionario || s.assigned 
            }));
            
            slotsHoje = slotsHoje.concat(mappedSlots);
        }
    });

    const uniqueSlots = [];
    const seen = new Set();
    slotsHoje.forEach(s => {
        if (s.funcionarioId) {
            const key = `${s.turnoId}-${s.funcionarioId}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueSlots.push(s);
            }
        }
    });

    const groupedSlots = {};
    uniqueSlots.forEach(s => {
        const tIdStr = String(s.turnoId);
        if (!groupedSlots[tIdStr]) groupedSlots[tIdStr] = [];
        groupedSlots[tIdStr].push(s);
    });

    const dayOfWeek = new Date(normToday + 'T12:00:00').getUTCDay();
    const diaId = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'][dayOfWeek];
    
    const escalaRef = escalasDoCargo.find(e => e.cobertura) || escalasDoCargo[0];
    const turnosEsperadosIds = [];
    
    if (escalaRef.cobertura && escalaRef.cobertura[diaId]) {
        Object.keys(escalaRef.cobertura[diaId]).forEach(tId => {
            if (escalaRef.cobertura[diaId][tId] > 0) {
                turnosEsperadosIds.push(tId);
            }
        });
    }
    
    Object.keys(groupedSlots).forEach(tId => {
        if (!turnosEsperadosIds.includes(tId)) {
            turnosEsperadosIds.push(tId);
        }
    });

    const sortedTurnos = turnosEsperadosIds
        .map(tId => turnos.find(t => String(t.id) === String(tId)))
        .filter(Boolean)
        .sort((a, b) => parseTimeToMinutes(a.inicio) - parseTimeToMinutes(b.inicio));

    if (sortedTurnos.length === 0) {
        shiftsContainer.innerHTML = '<p class="muted" style="text-align:center; width: 100%;">Nenhum turno programado para hoje neste cargo.</p>';
        return;
    }

    let minStart = Number.MAX_VALUE;
    let maxStart = 0;
    let maxEnd = 0;
    const shiftColors = [];

    sortedTurnos.forEach(turno => {
        const funcsInShift = groupedSlots[String(turno.id)] || [];
        
        const startMin = parseTimeToMinutes(turno.inicio);
        const endMin = parseTimeToMinutes(turno.fim) + (turno.diasDeDiferenca > 0 ? 1440 : 0);
        
        if (startMin < minStart) minStart = startMin;
        if (startMin > maxStart) maxStart = startMin;
        if (endMin > maxEnd) maxEnd = endMin;
        shiftColors.push(turno.cor);

        const block = document.createElement('div');
        block.className = 'shift-block';
        block.dataset.start = startMin;
        block.dataset.end = endMin;
        
        block.style.setProperty('--shift-color', turno.cor);
        block.style.setProperty('--shift-color-alpha', turno.cor + '66');

        const funcsHtml = funcsInShift.map(s => {
            const f = funcionarios.find(f => String(f.id) === String(s.funcionarioId));
            return f ? `<li>${f.nome.split(' ')[0]}</li>` : '';
        }).join('');

        const emptyPill = `<li style="color: var(--muted); box-shadow: none; opacity: 0.8; font-weight: normal;">Vazio</li>`;

        block.innerHTML = `
            <div class="shift-block-header">
                <span class="shift-badge" style="background-color: ${turno.cor}; color: #fff;">${turno.sigla}</span>
                <span class="shift-time">${turno.inicio} - ${turno.fim}</span>
            </div>
            <div class="shift-block-body" style="background-color: ${turno.cor}20;">
                <ul class="shift-funcs">${funcsHtml || emptyPill}</ul>
            </div>
        `;
        shiftsContainer.appendChild(block);
    });

    let timelineEnd = maxStart;
    if (minStart === maxStart) {
        timelineEnd = maxEnd;
    }
    if (timelineEnd === minStart) {
        timelineEnd = minStart + 1;
    }

    const progressEl = $("#status-hoje-progress");
    if (progressEl) {
        progressEl.dataset.min = minStart;
        progressEl.dataset.max = timelineEnd;
        
        const uniqueColors = [...new Set(shiftColors)];
        if (uniqueColors.length > 1) {
            progressEl.style.background = `linear-gradient(90deg, ${uniqueColors.join(', ')})`;
        } else if (uniqueColors.length === 1) {
            progressEl.style.background = uniqueColors[0];
        } else {
            progressEl.style.background = 'var(--brand)';
        }
    }

    if (statusHojeInterval) clearInterval(statusHojeInterval);
    updateTimelineProgress();
    statusHojeInterval = setInterval(updateTimelineProgress, 60000);
}

function renderStatusDeHoje() {
    const { escalas, cargos } = store.getState();
    const container = $("#status-hoje-container");
    const selectCargo = $("#status-hoje-cargo-select");
    
    if (!container || !selectCargo) return;

    const today = getTodayString();
    const normToday = universalDateNormalize(today);
    
    const escalasHoje = escalas.filter(e => {
        const normInicio = universalDateNormalize(e.inicio);
        const normFim = universalDateNormalize(e.fim);
        return normInicio <= normToday && normFim >= normToday;
    });

    if (escalasHoje.length === 0) {
        container.classList.add('hidden');
        if (statusHojeInterval) clearInterval(statusHojeInterval);
        return;
    }

    container.classList.remove('hidden');

    const cargosIds = [...new Set(escalasHoje.map(e => String(e.cargoId)))];
    const currentSelectedCargoId = String(selectCargo.value);
    selectCargo.innerHTML = '';
    
    selectCargo.classList.remove('hidden');
    selectCargo.disabled = cargosIds.length === 1;

    cargosIds.forEach(id => {
        const c = cargos.find(c => String(c.id) === String(id));
        if (c) {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = c.nome;
            selectCargo.appendChild(opt);
        }
    });

    const activeCargoId = cargosIds.includes(currentSelectedCargoId) && currentSelectedCargoId !== "" 
        ? currentSelectedCargoId 
        : cargosIds[0];
        
    selectCargo.value = activeCargoId;

    selectCargo.onchange = () => {
        const bodyContainer = $(".status-hoje-body");
        if (bodyContainer) {
            const currentHeight = bodyContainer.offsetHeight;
            bodyContainer.style.height = currentHeight + 'px';
            bodyContainer.style.overflowY = 'hidden';
            bodyContainer.style.opacity = '0';
            
            setTimeout(() => {
                renderShiftsForCargo(selectCargo.value, escalasHoje, today);
                
                bodyContainer.style.height = 'auto';
                const newHeight = bodyContainer.offsetHeight;
                
                bodyContainer.style.height = currentHeight + 'px';
                void bodyContainer.offsetWidth; 
                
                bodyContainer.style.height = newHeight + 'px';
                bodyContainer.style.opacity = '1';
                
                setTimeout(() => {
                    bodyContainer.style.height = '';
                    bodyContainer.style.overflowY = '';
                }, 400);
            }, 400); 
        } else {
            renderShiftsForCargo(selectCargo.value, escalasHoje, today);
        }
    };
    
    renderShiftsForCargo(activeCargoId, escalasHoje, today);
}

function updateHomeScreenDashboard() {
    try {
        const { turnos, cargos, funcionarios, equipes } = store.getState();
        const metricTurnosEl = $("#metric-turnos");
        const metricCargosEl = $("#metric-cargos");
        const metricFuncionariosEl = $("#metric-funcionarios");
        const metricEquipesEl = $("#metric-equipes");

        if (metricTurnosEl) metricTurnosEl.textContent = `🕒 Turnos: ${turnos.filter(t => !t.isSystem).length}`;
        if (metricCargosEl) metricCargosEl.textContent = `🏥 Cargos: ${cargos.length}`;
        if (metricFuncionariosEl) metricFuncionariosEl.textContent = `👨‍⚕️ Funcionários: ${funcionarios.length}`;
        if (metricEquipesEl) metricEquipesEl.textContent = `🤝 Equipes: ${equipes.length}`;

        const metricsPanel = $(".quick-metrics-panel");
        if (metricsPanel) {
            parseEmojisInElement(metricsPanel);
        }

        renderStatusDeHoje();
    } catch (e) {
    }
}

function go(page, options = {}) {
    if (isNavigating) return;

    const currentLevel = getEffectiveLevel();
    const requiredLevel = PAGE_ACCESS_LEVEL[page] || 1;

    if (currentLevel < requiredLevel && !options.force) {
        const prevStep = PROGRESS_STEPS.find(s => s.level === requiredLevel - 1);
        const prevStepTitle = prevStep ? prevStep.title : 'etapa anterior';
        showToast(`🔒 Conclua a etapa: "${prevStepTitle}" para desbloquear.`, 'error');
        return;
    }

    const currentPageEl = $('.page.active');
    const currentPageId = currentPageEl ? currentPageEl.id.replace('page-', '') : null;

    if (currentPageId === page && !options.force) return;

    (async () => {
        if (currentPageId && dirtyForms[currentPageId]) {
            const { confirmed } = await showConfirm({
                title: "Descartar Alterações?",
                message: "Você tem alterações não salvas. Deseja sair e perdê-las?",
                confirmText: "Sim, Sair"
            });
            if (!confirmed) return;
        }

        isNavigating = true;

        const transitionLogic = () => {
            if (currentPageEl) {
                currentPageEl.classList.remove('active');
                currentPageEl.classList.remove('fading-out');

                switch (currentPageId) {
                    case 'turnos': cancelEditTurno(); break;
                    case 'cargos': cancelEditCargo(); break;
                    case 'funcionarios': cancelEditFunc(); break;
                    case 'equipes': cancelEditEquipe(); break;
                    case 'gerar-escala':
                        resetGeradorWizard();
                        currentEscala = null;
                        if (typeof cleanupEditor === 'function') cleanupEditor();
                        break;
                }
            }

            const nextPageEl = $(`#page-${page}`);
            if (nextPageEl) {
                nextPageEl.classList.add('active');
            }

            toggleHelpPanel(false);
            const helpBtn = $("#context-help-btn");
            const hasHelpContent = loadHelpContent(page);
            if (helpBtn) {
                 helpBtn.style.display = hasHelpContent ? 'flex' : 'none';
            }

            $$(".tab-btn").forEach(b => b.classList.remove("active"));
            const activeTab = $(`.tab-btn[data-page="${page}"]`);
            if (activeTab) activeTab.classList.add('active');

            const pageTitleEl = $("#page-title");
            if (pageTitleEl) {
                if (page === 'home') {
                    pageTitleEl.textContent = `Início`;
                } else if (activeTab) {
                    const tabTextEl = activeTab.querySelector('.tab-text');
                    if (tabTextEl) pageTitleEl.textContent = tabTextEl.textContent;
                }
            }

            window.scrollTo(0, 0);

            updateUnlockUI();

            switch (page) {
                case 'home':
                    updateWelcomeMessage();
                    updateHomeScreenDashboard();
                    break;
                case 'cargos':
                    renderTurnosSelects();
                    break;
                case 'funcionarios':
                    renderFuncCargoSelect();
                    break;
                case 'equipes':
                    renderEquipeCargoSelect();
                    renderEquipes();
                    break;
                case 'gerar-escala': initGeradorPage(options); break;
                case 'relatorios': renderRelatoriosPage(); break;
                case 'escalas-salvas':
                    renderFiltroEscalasCargo();
                    renderEscalasList();
                    break;
                 case 'configuracoes':
                    loadConfigForm();
                    break;
            }
            parseEmojisInElement(document.body);
            isNavigating = false;
        };

        if (currentPageEl) {
            currentPageEl.addEventListener('animationend', transitionLogic, { once: true });
            currentPageEl.classList.add('fading-out');
        } else {
            transitionLogic();
        }
    })();
}

function renderRouter(actionName) {
    const currentPageEl = $('.page.active');
    const currentPageId = currentPageEl ? currentPageEl.id.replace('page-', '') : null;

    updateUnlockUI();
    updateHomeScreenDashboard();

    switch(actionName) {
        case 'LOAD_STATE':
            renderTurnos(); renderCargos(); renderFuncs(); renderArchivedFuncs(); renderEquipes(); renderEscalasList();
            renderTurnosSelects(); renderFuncCargoSelect(); renderEquipeCargoSelect();
            loadConfigForm(); updateWelcomeMessage();
            updateUnlockUI(); 
            break;
        case 'SAVE_TURNO':
        case 'DELETE_TURNO':
            if (currentPageId === 'turnos') renderTurnos();
            if (currentPageId === 'cargos') renderTurnosSelects();
            if (currentPageId === 'equipes') { renderEquipeCargoSelect(); renderEquipes(); }
            break;
        case 'SAVE_CARGO':
        case 'DELETE_CARGO':
            if (currentPageId === 'cargos') renderCargos();
            if (currentPageId === 'funcionarios') renderFuncCargoSelect();
            if (currentPageId === 'equipes') { renderEquipeCargoSelect(); renderEquipes(); }
            break;
        case 'SAVE_FUNCIONARIO':
        case 'DELETE_FUNCIONARIO':
        case 'ARCHIVE_FUNCIONARIO':
        case 'UNARCHIVE_FUNCIONARIO':
            if (currentPageId === 'funcionarios') {
                 renderFuncs();
                 renderArchivedFuncs();
            }
            if (currentPageId === 'equipes') renderEquipes();
            break;
        case 'SAVE_EQUIPE':
        case 'DELETE_EQUIPE':
            if (currentPageId === 'equipes') renderEquipes();
            break;
        case 'SAVE_ESCALA':
             break;
        case 'DELETE_ESCALA_SALVA':
             if (currentPageId === 'escalas-salvas') renderEscalasList();
             if (currentPageId === 'relatorios') renderRelatoriosPage();
            break;
        case 'SAVE_CONFIG':
            loadConfigForm();
            updateWelcomeMessage();
            break;
    }

    setTimeout(() => {
        updateUnlockUI();
        updateHomeScreenDashboard();
    }, 50);
}

function setupAppListeners() {
    $$(".tab-btn").forEach(b => b.addEventListener('click', () => go(b.dataset.page)));
    $$(".home-card").forEach(c => c.addEventListener('click', (e) => {
        e.preventDefault();
        go(c.dataset.goto);
    }));

    const btnGotoRelatorios = $("#btn-goto-relatorios");
    if(btnGotoRelatorios) {
        btnGotoRelatorios.addEventListener('click', () => go('relatorios'));
    }

    const statusHojeHeaderClickable = $("#status-hoje-header-clickable");
    if (statusHojeHeaderClickable) {
        statusHojeHeaderClickable.addEventListener('click', () => {
            const card = $("#status-hoje-main-card");
            if (card) card.classList.toggle('collapsed');
        });
    }
}

function setupGlobalAutocomplete() {
    const enforce = () => {
        document.querySelectorAll('input').forEach(input => {
            if (input.getAttribute('autocomplete') !== 'off') {
                input.setAttribute('autocomplete', 'off');
                if (input.name) {
                    input.setAttribute('autocomplete', 'off'); 
                }
            }
        });
    };
    enforce();
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                enforce();
            }
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function initMainApp() {
    const splashScreen = $("#splash-screen");
    const splashUserName = $("#splash-user-name");
    const { config } = store.getState();
    const body = document.body;

    body.classList.add('app-loading');

    const nome = config.nome;
    splashUserName.textContent = (nome && nome.trim() !== '') ? nome : 'Usuário';

    splashScreen.classList.add('animate');
    parseEmojisInElement(document.body);

    store.subscribe(renderRouter);
    renderRouter('LOAD_STATE');

    setTimeout(() => {
        splashScreen.classList.add('closing');

        splashScreen.addEventListener('transitionend', () => {
            splashScreen.style.display = 'none';
            body.classList.remove('app-loading');
            document.body.classList.add('app-ready');

            go("home", { force: true });
            const pageTitleEl = $("#page-title");
            if (pageTitleEl) pageTitleEl.textContent = "Início";

        }, { once: true });

    }, 4000);
}

function init() {
    setupGlobalAutocomplete();

    window.addEventListener('mousemove', e => {
        document.body.style.setProperty('--mouse-x', `${e.clientX}px`);
        document.body.style.setProperty('--mouse-y', `${e.clientY}px`);
    });

    const splashScreen = $("#splash-screen");

    if (typeof checkLicenseOnStartup === 'function') {
        const isLicensed = checkLicenseOnStartup();
        if (!isLicensed) {
            if (splashScreen) splashScreen.style.display = 'none';
            return; 
        }
    }

    store.dispatch('LOAD_STATE');

    if (store.getState().dataCorrupted) {
        handleDataCorruptionError();
        return;
    }

    const onboardingComplete = localStorage.getItem('ge_onboarding_complete') === 'true';

    if (!onboardingComplete) {
        if (splashScreen) {
            splashScreen.style.display = 'none';
        }
        initWelcomeScreen();
    } else {
        const welcomeOverlay = $("#welcome-overlay");
        if(welcomeOverlay) {
            welcomeOverlay.style.display = 'none';
        }
        setupAppListeners();
        initMainApp();
    }
}

document.addEventListener("DOMContentLoaded", init);