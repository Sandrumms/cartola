let leagueData = { teams: [], currentRound: 1, lastUpdate: "", previousLeaders: [] };
let previousLeader = null;
const FALLBACK_IMAGE = 'https://via.placeholder.com/150';
const TEAMS_URL = 'https://api.sheety.co/69db349f2a9087927b5c4f915606d4e1/ligaDosAmigos2025/teams'; // Substitua pelo URL do Sheety
const METADATA_URL = 'https://api.sheety.co/69db349f2a9087927b5c4f915606d4e1/ligaDosAmigos2025/metadata'; // Substitua pelo URL do Sheety

function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
}

async function loadLeagueData() {
    try {
        const [teamsResponse, metadataResponse] = await Promise.all([
            fetch(TEAMS_URL),
            fetch(METADATA_URL)
        ]);
        if (!teamsResponse.ok || !metadataResponse.ok) {
            throw new Error('Erro ao carregar dados do Google Sheets');
        }
        const teamsData = await teamsResponse.json();
        const metadataData = await metadataResponse.json();

        leagueData.teams = teamsData.teams.map(team => ({
            id: team.id,
            name: team.name,
            manager: team.manager,
            managerAvatar: team.managerAvatar,
            logo: team.logo,
            totalPoints: parseFloat(team.totalPoints) || 0,
            rounds: JSON.parse(team.rounds || '[]'),
            stats: {
                wins: 0, // Será recalculado abaixo
                avgPoints: 0, // Será recalculado abaixo
                bestRound: parseInt(team.stats_bestRound) || 1
            }
        }));

        // Recalcular stats.wins e stats.avgPoints com base nos rounds
        leagueData.teams.forEach(team => {
            if (!team.rounds || team.rounds.length === 0) return;

            // Calcular totalPoints (pra garantir que não dependa do Sheets)
            team.totalPoints = team.rounds.reduce((sum, round) => sum + (parseFloat(round.points) || 0), 0);

            // Calcular stats.wins (quantas vezes foi o maior pontuador da rodada)
            team.stats.wins = 0;
            for (let roundNum = 1; roundNum <= leagueData.currentRound; roundNum++) {
                const roundData = team.rounds.find(r => r.round === roundNum);
                if (roundData) {
                    const roundScores = leagueData.teams.map(t => {
                        const r = t.rounds.find(r => r.round === roundNum);
                        return r ? r.points : 0;
                    });
                    const roundMax = Math.max(...roundScores);
                    if (roundData.points === roundMax) {
                        team.stats.wins++;
                        console.log(`Vitória adicionada a ${team.name} na rodada ${roundNum} (${roundData.points} pontos)`);
                    }
                }
            }

            // Calcular stats.avgPoints
            const totalRounds = team.rounds.length;
            team.stats.avgPoints = totalRounds > 0 ? team.totalPoints / totalRounds : 0;
            console.log(`Média de ${team.name}: ${team.stats.avgPoints.toFixed(2)}`);

            // Calcular stats.bestRound
            const bestRoundPoints = Math.max(...team.rounds.map(r => r.points || 0), 0);
            team.stats.bestRound = team.rounds.find(r => r.points === bestRoundPoints)?.round || 1;
            console.log(`Melhor rodada de ${team.name}: ${team.stats.bestRound} (${bestRoundPoints} pontos)`);
        });

        const metadata = metadataData.metadata[0];
        leagueData.currentRound = parseInt(metadata.currentRound) || 1;
        leagueData.lastUpdate = metadata.lastUpdate || new Date().toISOString();
        leagueData.previousLeaders = JSON.parse(metadata.previousLeaders || '[]');
    } catch (error) {
        console.error('Erro ao carregar dados:', error);
        alert('Não foi possível carregar os dados da liga. Tente novamente.');
    }
}
function sortTeams() {
    if (!leagueData.teams.length) return;
    leagueData.teams.sort((a, b) => b.totalPoints - a.totalPoints);
}

function updateLeader() {
    if (!leagueData.teams.length) {
        console.warn('Nenhum time disponível para atualizar o líder');
        return;
    }
    sortTeams();
    const currentLeader = leagueData.teams[0];
    if (previousLeader && previousLeader.id !== currentLeader.id) {
        showNewLeaderNotification(previousLeader, currentLeader);
        leagueData.previousLeaders.push({ team: previousLeader, untilRound: leagueData.currentRound - 1 });
    }
    document.getElementById('leader-name').textContent = sanitizeInput(currentLeader.name);
    document.getElementById('leader-manager').textContent = sanitizeInput(currentLeader.manager);
    document.getElementById('leader-manager-avatar').src = currentLeader.managerAvatar || FALLBACK_IMAGE;
    document.getElementById('leader-points').textContent = currentLeader.totalPoints.toFixed(2);
    document.getElementById('leader-avatar').src = currentLeader.logo || FALLBACK_IMAGE;
    document.getElementById('leader-rounds').textContent = currentLeader.rounds.length;
    document.getElementById('leader-wins').textContent = currentLeader.stats.wins;
    document.getElementById('leader-avg').textContent = currentLeader.stats.avgPoints.toFixed(2);
    previousLeader = { ...currentLeader };
    updateLastUpdate();
}

function showNewLeaderNotification(oldLeader, newLeader) {
    const notification = document.getElementById('new-leader-notification');
    const message = document.getElementById('notification-message');
    message.textContent = `${sanitizeInput(newLeader.name)} assumiu a liderança!`;
    notification.classList.add('show');
    setTimeout(() => notification.classList.remove('show'), 5000);
}

function renderRankingTable() {
    sortTeams();
    const tbody = document.getElementById('ranking-body');
    const fragment = document.createDocumentFragment();
    leagueData.teams.forEach((team, index) => {
        const lastRound = team.rounds[team.rounds.length - 1];
        const row = document.createElement('tr');
        row.className = `animate-fadeIn`;
        row.innerHTML = `
            <td>${index + 1}º</td>
            <td><div class="team-with-logo"><img src="${team.logo || FALLBACK_IMAGE}" alt="${sanitizeInput(team.name)}" class="team-logo"><span>${sanitizeInput(team.name)}</span></div></td>
            <td><div class="team-with-logo"><img src="${team.managerAvatar || FALLBACK_IMAGE}" alt="${sanitizeInput(team.manager)}" class="team-logo"><span>${sanitizeInput(team.manager)}</span></div></td>
            <td class="highlight">${team.totalPoints.toFixed(2)}</td>
            <td>${lastRound ? lastRound.points.toFixed(2) : '-'}</td>
        `;
        fragment.appendChild(row);
    });
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
    updateLastUpdate();
}

function renderHistoryTable() {
    const tbody = document.getElementById('history-body');
    const thead = document.getElementById('history-header');
    const fragment = document.createDocumentFragment();
    thead.innerHTML = '<th scope="col">Time</th>';
    for (let i = 1; i <= leagueData.currentRound; i++) {
        thead.innerHTML += `<th scope="col">Rodada ${i}</th>`;
    }
    leagueData.teams.forEach(team => {
        const row = document.createElement('tr');
        let roundsHtml = '';
        for (let i = 1; i <= leagueData.currentRound; i++) {
            const round = team.rounds.find(r => r.round === i);
            roundsHtml += `<td class="${round ? 'highlight' : ''}">${round ? round.points.toFixed(2) : '-'}</td>`;
        }
        row.innerHTML = `
            <td><div class="team-with-logo"><img src="${team.logo || FALLBACK_IMAGE}" alt="${sanitizeInput(team.name)}" class="team-logo"><span>${sanitizeInput(team.name)}</span></div></td>
            ${roundsHtml}
        `;
        fragment.appendChild(row);
    });
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
}

function abbreviateTeamName(name) {
    if (!name) return 'N/A';
    const words = name.trim().toUpperCase().split(/\s+/);
    if (words.length === 1) return words[0].slice(0, 3);
    let abbr = '';
    for (let i = 0; i < words.length && abbr.length < 4; i++) {
        if (words[i].length >= 3) {
            abbr += words[i].slice(0, Math.max(1, 4 - abbr.length));
        } else {
            abbr += words[i][0] || '';
        }
    }
    return abbr.slice(0, 4);
}

function renderChart() {
    console.log('Tentando renderizar gráfico. leagueData:', JSON.stringify(leagueData, null, 2));
    const ctx = document.getElementById('pointsChart')?.getContext('2d');
    if (!ctx) {
        console.error('Canvas #pointsChart não encontrado no DOM');
        return;
    }
    if (!leagueData.teams.length || leagueData.currentRound < 1) {
        console.warn('Sem dados suficientes para o gráfico. Times:', leagueData.teams.length, 'Rodada:', leagueData.currentRound);
        return;
    }
    const teamColors = [
        '#e94560', '#0f3460', '#4caf50', '#ff9800', '#9c27b0',
        '#2196f3', '#ffeb3b', '#795548', '#00bcd4', '#f44336'
    ];
    const chartData = {
        labels: Array.from({ length: leagueData.currentRound }, (_, i) => `Rodada ${i + 1}`),
        datasets: leagueData.teams.map((team, index) => {
            console.log(`Processando time: ${team.name}, Rounds:`, JSON.stringify(team.rounds, null, 2));
            const data = Array.from({ length: leagueData.currentRound }, (_, i) => {
                const round = team.rounds.find(r => r.round === i + 1);
                return round ? round.points : 0;
            });
            return {
                label: abbreviateTeamName(team.name),
                data: data,
                borderColor: teamColors[index % teamColors.length],
                backgroundColor: teamColors[index % teamColors.length] + '33',
                borderWidth: 2,
                pointRadius: 4,
                fill: false,
                tension: 0.2
            };
        })
    };
    console.log('Dados do gráfico:', JSON.stringify(chartData, null, 2));
    if (window.pointsChart instanceof Chart) {
        window.pointsChart.destroy();
    }
    window.pointsChart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: { size: 10 },
                        boxWidth: 15,
                        padding: 10,
                        usePointStyle: true
                    }
                },
                title: {
                    display: true,
                    text: 'Pontuação por Rodada',
                    font: { size: 14 },
                    padding: { top: 10, bottom: 20 }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: { size: 12 },
                    bodyFont: { size: 10 },
                    callbacks: {
                        label: context => `${context.dataset.label}: ${context.raw.toFixed(2)} pontos`
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Pontos', font: { size: 12 } },
                    ticks: { stepSize: 20, font: { size: 10 } },
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }
                },
                x: {
                    title: { display: true, text: 'Rodada', font: { size: 12 } },
                    ticks: { font: { size: 10 } },
                    grid: { display: false }
                }
            },
            layout: {
                padding: 10
            },
            elements: {
                line: { borderCapStyle: 'round' },
                point: { pointStyle: 'circle' }
            },
            animation: {
                duration: 800,
                easing: 'easeInOutQuad'
            }
        }
    });
}

function updateLastUpdate() {
    document.getElementById('last-update').textContent = `Última atualização: ${new Date(leagueData.lastUpdate).toLocaleString('pt-BR')}`;
}

function fetchApiData() {
    try {
        alert('Função de API de pontuação ainda não implementada. Forneça a URL da API para integração.');
    } catch (error) {
        console.error('Erro ao buscar dados da API:', error);
        alert('Erro ao carregar dados da API. Tente novamente mais tarde.');
    }
}

function setupModal() {
    const modal = document.getElementById('update-round-modal');
    const form = document.getElementById('update-round-form');
    const pointsInputs = document.getElementById('points-inputs');
    const cancelBtn = document.getElementById('cancel-modal');
    const ADMIN_PASSWORD = 'sandro000123';

    document.getElementById('update-round-btn').addEventListener('click', () => {
        pointsInputs.innerHTML = `
            <div class="points-input">
                <label for="admin-password">Senha de Administrador</label>
                <input type="password" id="admin-password" required>
            </div>
        `;
        leagueData.teams.forEach(team => {
            const div = document.createElement('div');
            div.className = 'points-input';
            div.innerHTML = `
                <label for="points-${team.id}">${sanitizeInput(team.name)}</label>
                <input type="number" id="points-${team.id}" step="0.01" min="0" required>
            `;
            pointsInputs.appendChild(div);
        });
        modal.showModal();
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const password = document.getElementById('admin-password').value;
        if (password !== ADMIN_PASSWORD) {
            alert('Senha incorreta! Apenas administradores podem atualizar.');
            return;
        }
        const pointsArray = leagueData.teams.map(team => {
            const input = document.getElementById(`points-${team.id}`);
            return parseFloat(input.value) || 0;
        });
        if (pointsArray.length !== leagueData.teams.length) {
            alert('Por favor, preencha todos os campos corretamente.');
            return;
        }
        updateRound(pointsArray);
        modal.close();
    });

    cancelBtn.addEventListener('click', () => modal.close());
}

function updateRound(pointsArray) {
    console.log('Atualizando rodada. Pontos recebidos:', pointsArray);
    leagueData.currentRound++;

    // Adicionar os pontos da nova rodada e atualizar totalPoints
    pointsArray.forEach((points, index) => {
        const team = leagueData.teams[index];
        if (!team || !team.rounds) {
            console.warn(`Time ${index} inválido ou sem rounds`);
            return;
        }
        const pointsNum = parseFloat(points) || 0;
        team.rounds.push({ round: leagueData.currentRound, points: pointsNum, position: 0 });
        team.totalPoints = (parseFloat(team.totalPoints) || 0) + pointsNum;
        console.log(`Time ${team.name}: totalPoints atualizado para ${team.totalPoints}`);
    });

    // Determinar o maior pontuador da rodada atual
    const currentRoundPoints = pointsArray.map((points, index) => ({
        teamIndex: index,
        points: parseFloat(points) || 0
    })).filter(p => leagueData.teams[p.teamIndex]);
    if (currentRoundPoints.length === 0) {
        console.warn('Nenhum ponto válido para a rodada atual');
        return;
    }
    const maxPoints = Math.max(...currentRoundPoints.map(p => p.points));
    const roundWinners = currentRoundPoints.filter(p => p.points === maxPoints).map(p => p.teamIndex);
    console.log(`Maior pontuador da rodada ${leagueData.currentRound}: ${maxPoints}, Times: ${roundWinners.map(i => leagueData.teams[i].name).join(', ')}`);

    // Atualizar stats.wins e avgPoints para todas as rodadas
    leagueData.teams.forEach((team, teamIndex) => {
        if (!team.rounds) return;
        team.stats.wins = 0; // Resetar vitórias
        const totalRounds = team.rounds.length;

        for (let roundNum = 1; roundNum <= leagueData.currentRound; roundNum++) {
            const roundData = team.rounds.find(r => r.round === roundNum);
            if (roundData) {
                const roundScores = leagueData.teams.map(t => {
                    const r = t.rounds.find(r => r.round === roundNum);
                    return r ? r.points : 0;
                });
                const roundMax = Math.max(...roundScores);
                if (roundData.points === roundMax) {
                    team.stats.wins++;
                    console.log(`Vitória adicionada a ${team.name} na rodada ${roundNum} (${roundData.points} pontos)`);
                }
            }
        }

        // Calcular média corretamente
        team.stats.avgPoints = totalRounds > 0 ? team.totalPoints / totalRounds : 0;
        console.log(`Média de ${team.name}: ${team.stats.avgPoints.toFixed(2)}`);

        // Atualizar bestRound
        const bestRoundPoints = Math.max(...team.rounds.map(r => r.points || 0), 0);
        team.stats.bestRound = team.rounds.find(r => r.points === bestRoundPoints)?.round || 1;
        console.log(`Melhor rodada de ${team.name}: ${team.stats.bestRound} (${bestRoundPoints} pontos)`);

        // Atualizar posição da rodada atual
        const lastRound = team.rounds.find(r => r.round === leagueData.currentRound);
        if (lastRound) lastRound.position = 0; // Recalculado depois
    });

    // Recalcular posições com base no totalPoints
    sortTeams();
    leagueData.teams.forEach((team, index) => {
        const lastRound = team.rounds.find(r => r.round === leagueData.currentRound);
        if (lastRound) lastRound.position = index + 1;
        console.log(`Posição de ${team.name}: ${index + 1}º`);
    });

    console.log('leagueData atualizado:', JSON.stringify(leagueData, null, 2));
    updateLeader();
    renderRankingTable();
    renderHistoryTable();
    renderChart();
    leagueData.lastUpdate = new Date().toISOString();
    updateLastUpdate();
}
function handleWidgetLoading() {
    setTimeout(() => {
        const loading = document.getElementById('widget-loading');
        const widget = document.querySelector('.scores-widget > div[data-widget-type]');
        const fallback = document.getElementById('widget-fallback');
        if (loading) loading.style.display = 'none';
        if (widget && widget.innerHTML.trim() === '' && fallback) {
            fallback.style.display = 'block';
        }
    }, 5000);

    document.getElementById('retry-widget')?.addEventListener('click', () => {
        const loading = document.getElementById('widget-loading');
        const fallback = document.getElementById('widget-fallback');
        loading.style.display = 'flex';
        fallback.style.display = 'none';
        setTimeout(() => {
            const widget = document.querySelector('.scores-widget > div[data-widget-type]');
            if (widget && widget.innerHTML.trim() === '') {
                fallback.style.display = 'block';
                loading.style.display = 'none';
            } else {
                loading.style.display = 'none';
            }
        }, 5000);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    let retries = 3;
    while (retries > 0) {
        try {
            await loadLeagueData();
            break;
        } catch (error) {
            console.warn(`Tentativa de carregamento falhou. Restam ${retries - 1} tentativas.`);
            retries--;
            if (retries === 0) {
                console.error('Falha ao carregar dados após tentativas:', error);
                alert('Não foi possível carregar os dados da liga. Verifique o backend.');
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    if (leagueData.teams.length) {
        console.log('Dados carregados:', JSON.stringify(leagueData, null, 2));
        sortTeams();
        updateLeader();
        renderRankingTable();
        renderHistoryTable();
        renderChart();
    } else {
        console.warn('Nenhum time carregado após fetch.');
    }
    setupModal();
    handleWidgetLoading();

    window.addEventListener('scroll', () => {
        const header = document.getElementById('header');
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    document.querySelectorAll('nav a').forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelectorAll('nav a').forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            this.setAttribute('aria-current', 'page');
            const targetId = this.getAttribute('href').substring(1);
            document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
        });
    });
});