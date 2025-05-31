import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { FiUsers, FiActivity, FiCalendar, FiHome, FiUser, FiClipboard } from 'react-icons/fi';
import { FaHospital, FaUserTie } from 'react-icons/fa';
import { Line, Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Registrar componentes do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalPacientes: 0,
    pacientesDomiciliar: 0,
    pacientesHospitalar: 0,
    pacientesFreelancer: 0,
    totalAgendamentos: 0,
    agendamentosHoje: 0,
    sinaisVitaisHoje: 0,
    alertasAtivos: 0
  });
  
  const [sinaisVitaisData, setSinaisVitaisData] = useState({
    labels: [],
    datasets: []
  });
  
  const [categoriasData, setCategoriasData] = useState({
    labels: ['Domiciliar', 'Hospitalar', 'Freelancer'],
    datasets: [
      {
        data: [0, 0, 0],
        backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc'],
        hoverBackgroundColor: ['#2e59d9', '#17a673', '#2c9faf'],
        hoverBorderColor: 'rgba(234, 236, 244, 1)',
      },
    ],
  });
  
  const [agendamentosData, setAgendamentosData] = useState({
    labels: [],
    datasets: [
      {
        label: 'Agendamentos',
        backgroundColor: 'rgba(78, 115, 223, 0.5)',
        borderColor: 'rgba(78, 115, 223, 1)',
        data: [],
      },
    ],
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        
        // Buscar estatísticas de pacientes
        const { data: pacientes, error: pacientesError } = await supabase
          .from('pacientes')
          .select('*');
          
        if (pacientesError) throw pacientesError;
        
        const pacientesDomiciliar = pacientes?.filter(p => p.categoria === 'domiciliar').length || 0;
        const pacientesHospitalar = pacientes?.filter(p => p.categoria === 'hospitalar').length || 0;
        const pacientesFreelancer = pacientes?.filter(p => p.categoria === 'freelancer').length || 0;
        
        // Buscar agendamentos
        const hoje = new Date().toISOString().split('T')[0];
        const { data: agendamentos, error: agendamentosError } = await supabase
          .from('agendamentos')
          .select('*');
          
        if (agendamentosError) throw agendamentosError;
        
        const agendamentosHoje = agendamentos?.filter(a => 
          a.data_agendamento && a.data_agendamento.startsWith(hoje)
        ).length || 0;
        
        // Buscar sinais vitais
        const { data: sinaisVitais, error: sinaisError } = await supabase
          .from('sinais_vitais')
          .select('*')
          .order('data_hora', { ascending: false });
          
        if (sinaisError) throw sinaisError;
        
        const sinaisVitaisHoje = sinaisVitais?.filter(s => 
          s.data_hora && s.data_hora.startsWith(hoje)
        ).length || 0;
        
        // Calcular alertas ativos (sinais vitais fora dos parâmetros da OMS)
        const alertasAtivos = sinaisVitais?.filter(s => {
          // Parâmetros da OMS
          const pressaoSistolicaAlta = 140;
          const pressaoSistolicaBaixa = 90;
          const temperaturaAlta = 37.8;
          const temperaturaBaixa = 35.0;
          const fcAlta = 100;
          const fcBaixa = 60;
          const frAlta = 20;
          const frBaixa = 12;
          const satBaixa = 95;
          const glicemiaAlta = 180;
          const glicemiaBaixa = 70;
          
          // Extrair valores da pressão arterial (formato "120/80")
          let sistolica = 0;
          if (s.pressao_arterial && s.pressao_arterial.includes('/')) {
            sistolica = parseInt(s.pressao_arterial.split('/')[0]);
          }
          
          // Verificar se algum parâmetro está fora do normal
          return (
            (sistolica > 0 && (sistolica > pressaoSistolicaAlta || sistolica < pressaoSistolicaBaixa)) ||
            (s.temperatura && (s.temperatura > temperaturaAlta || s.temperatura < temperaturaBaixa)) ||
            (s.frequencia_cardiaca && (s.frequencia_cardiaca > fcAlta || s.frequencia_cardiaca < fcBaixa)) ||
            (s.frequencia_respiratoria && (s.frequencia_respiratoria > frAlta || s.frequencia_respiratoria < frBaixa)) ||
            (s.saturacao && s.saturacao < satBaixa) ||
            (s.glicemia && (s.glicemia > glicemiaAlta || s.glicemia < glicemiaBaixa))
          );
        }).length || 0;
        
        // Preparar dados para o gráfico de sinais vitais
        const ultimos7Dias = [];
        for (let i = 6; i >= 0; i--) {
          const data = new Date();
          data.setDate(data.getDate() - i);
          ultimos7Dias.push(data.toISOString().split('T')[0]);
        }
        
        const sinaisPorDia = ultimos7Dias.map(dia => {
          return sinaisVitais?.filter(s => s.data_hora && s.data_hora.startsWith(dia)).length || 0;
        });
        
        setSinaisVitaisData({
          labels: ultimos7Dias.map(dia => {
            const data = new Date(dia);
            return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          }),
          datasets: [
            {
              label: 'Registros de Sinais Vitais',
              data: sinaisPorDia,
              fill: false,
              backgroundColor: 'rgba(75, 192, 192, 0.2)',
              borderColor: 'rgba(75, 192, 192, 1)',
              tension: 0.1
            }
          ]
        });
        
        // Preparar dados para o gráfico de categorias de pacientes
        setCategoriasData({
          labels: ['Domiciliar', 'Hospitalar', 'Freelancer'],
          datasets: [
            {
              data: [pacientesDomiciliar, pacientesHospitalar, pacientesFreelancer],
              backgroundColor: ['#4e73df', '#1cc88a', '#36b9cc'],
              hoverBackgroundColor: ['#2e59d9', '#17a673', '#2c9faf'],
              hoverBorderColor: 'rgba(234, 236, 244, 1)',
            },
          ],
        });
        
        // Preparar dados para o gráfico de agendamentos
        const proximos7Dias = [];
        for (let i = 0; i < 7; i++) {
          const data = new Date();
          data.setDate(data.getDate() + i);
          proximos7Dias.push(data.toISOString().split('T')[0]);
        }
        
        const agendamentosPorDia = proximos7Dias.map(dia => {
          return agendamentos?.filter(a => a.data_agendamento && a.data_agendamento.startsWith(dia)).length || 0;
        });
        
        setAgendamentosData({
          labels: proximos7Dias.map(dia => {
            const data = new Date(dia);
            return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          }),
          datasets: [
            {
              label: 'Agendamentos',
              backgroundColor: 'rgba(78, 115, 223, 0.5)',
              borderColor: 'rgba(78, 115, 223, 1)',
              data: agendamentosPorDia,
            },
          ],
        });
        
        // Atualizar estatísticas
        setStats({
          totalPacientes: pacientes?.length || 0,
          pacientesDomiciliar,
          pacientesHospitalar,
          pacientesFreelancer,
          totalAgendamentos: agendamentos?.length || 0,
          agendamentosHoje,
          sinaisVitaisHoje,
          alertasAtivos
        });
        
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <h1 className="text-xl font-bold mb-4">Dashboard</h1>
      
      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="card bg-primary text-white">
          <div className="card-body flex items-center">
            <div className="icon-circle bg-white bg-opacity-20 mr-3">
              <FiUsers size={24} />
            </div>
            <div>
              <div className="text-xs uppercase mb-1">Total de Pacientes</div>
              <div className="text-2xl font-bold">{stats.totalPacientes}</div>
            </div>
          </div>
          <Link to="/pacientes" className="card-footer text-white text-xs py-2">
            Ver detalhes
          </Link>
        </div>
        
        <div className="card bg-success text-white">
          <div className="card-body flex items-center">
            <div className="icon-circle bg-white bg-opacity-20 mr-3">
              <FiActivity size={24} />
            </div>
            <div>
              <div className="text-xs uppercase mb-1">Sinais Vitais Hoje</div>
              <div className="text-2xl font-bold">{stats.sinaisVitaisHoje}</div>
            </div>
          </div>
          <Link to="/sinais-vitais" className="card-footer text-white text-xs py-2">
            Ver detalhes
          </Link>
        </div>
        
        <div className="card bg-info text-white">
          <div className="card-body flex items-center">
            <div className="icon-circle bg-white bg-opacity-20 mr-3">
              <FiCalendar size={24} />
            </div>
            <div>
              <div className="text-xs uppercase mb-1">Agendamentos Hoje</div>
              <div className="text-2xl font-bold">{stats.agendamentosHoje}</div>
            </div>
          </div>
          <Link to="/agendamentos" className="card-footer text-white text-xs py-2">
            Ver detalhes
          </Link>
        </div>
        
        <div className="card bg-warning text-white">
          <div className="card-body flex items-center">
            <div className="icon-circle bg-white bg-opacity-20 mr-3">
              <FiActivity size={24} />
            </div>
            <div>
              <div className="text-xs uppercase mb-1">Alertas Ativos</div>
              <div className="text-2xl font-bold">{stats.alertasAtivos}</div>
            </div>
          </div>
          <Link to="/sinais-vitais" className="card-footer text-white text-xs py-2">
            Ver detalhes
          </Link>
        </div>
      </div>
      
      {/* Cards de categorias de pacientes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <FiHome className="inline mr-2" />
              Pacientes Domiciliares
            </h2>
          </div>
          <div className="card-body">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">{stats.pacientesDomiciliar}</div>
              <div className="text-sm text-gray-500 mt-2">Total de pacientes em atendimento domiciliar</div>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <FaHospital className="inline mr-2" />
              Pacientes Hospitalares
            </h2>
          </div>
          <div className="card-body">
            <div className="text-center">
              <div className="text-4xl font-bold text-success">{stats.pacientesHospitalar}</div>
              <div className="text-sm text-gray-500 mt-2">Total de pacientes em atendimento hospitalar</div>
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">
              <FaUserTie className="inline mr-2" />
              Pacientes Freelancer
            </h2>
          </div>
          <div className="card-body">
            <div className="text-center">
              <div className="text-4xl font-bold text-info">{stats.pacientesFreelancer}</div>
              <div className="text-sm text-gray-500 mt-2">Total de pacientes em atendimento freelancer</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Distribuição de Pacientes</h2>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <Pie 
                data={categoriasData} 
                options={{
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>
        
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Registros de Sinais Vitais (Últimos 7 dias)</h2>
          </div>
          <div className="card-body">
            <div className="chart-container">
              <Line 
                data={sinaisVitaisData} 
                options={{
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'top',
                    },
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      ticks: {
                        precision: 0
                      }
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="card mb-6">
        <div className="card-header">
          <h2 className="card-title">Agendamentos (Próximos 7 dias)</h2>
        </div>
        <div className="card-body">
          <div className="chart-container" style={{ height: '300px' }}>
            <Bar 
              data={agendamentosData} 
              options={{
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      precision: 0
                    }
                  }
                }
              }}
            />
          </div>
        </div>
      </div>
      
      {/* Lista de pacientes recentes */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <FiUser className="inline mr-2" />
            Pacientes Recentes
          </h2>
        </div>
        <div className="card-body">
          <Link to="/pacientes" className="btn btn-primary btn-sm mb-4">
            Ver todos os pacientes
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
