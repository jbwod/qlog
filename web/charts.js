// Chart Initialization and Management
let severityChart, protocolChart, trendsChart;

function initCharts() {
    const severityCtx = document.getElementById('severityChart');
    const protocolCtx = document.getElementById('protocolChart');
    const trendsCtx = document.getElementById('trendsChart');
    
    if (severityCtx) {
        severityChart = new Chart(severityCtx, {
            type: 'doughnut',
            data: {
                labels: ['Emergency', 'Alert', 'Critical', 'Error', 'Warning', 'Notice', 'Informational', 'Debug'],
                datasets: [{
                    data: [0, 0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: [
                        '#ef4444', '#f97316', '#f59e0b', '#eab308',
                        '#84cc16', '#22c55e', '#10b981', '#14b8a6'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#9ca3af',
                            font: { size: 12 }
                        }
                    }
                }
            }
        });
    }
    
    if (protocolCtx) {
        protocolChart = new Chart(protocolCtx, {
            type: 'pie',
            data: {
                labels: ['UDP', 'TCP', 'TLS'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#6366f1', '#8b5cf6', '#ec4899']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#9ca3af',
                            font: { size: 12 }
                        }
                    }
                }
            }
        });
    }
    
    if (trendsCtx) {
        trendsChart = new Chart(trendsCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Messages',
                    data: [],
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        labels: {
                            color: '#9ca3af'
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: '#9ca3af' },
                        grid: { color: '#2d3441' }
                    },
                    x: {
                        ticks: { color: '#9ca3af' },
                        grid: { color: '#2d3441' }
                    }
                }
            }
        });
    }
}

