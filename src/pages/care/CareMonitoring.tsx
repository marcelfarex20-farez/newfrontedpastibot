import React, { useState, useEffect } from "react";
import { IonContent, IonPage, IonIcon, IonSpinner, IonText } from "@ionic/react";
import { useHistory } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
    statsChart, trendingUp, checkmarkCircle, closeCircle,
    time, calendar, person, medkit, alertCircle, arrowBack,
    chevronForward, fitness, barChart, list, informationCircle, refresh
} from "ionicons/icons";
import { api } from "../../api/axios";
import StatusModal from "../../components/StatusModal";



interface Patient {
    id: number;
    name: string;
    age?: number;
    gender?: string;
    condition?: string;
    userId?: number;
    linkCode?: string;
    emergencyPhone?: string; // Added field
    user?: {
        photoUrl?: string;
        bio?: string;
    };
}

interface MedicineStats {
    id: number;
    name: string;
    dosage: string;
    taken: number;
    missed: number;
    total: number;
    adherence: number;
}

interface PatientStats {
    totalMedicines: number;
    totalReminders: number;
    completedToday: number;
    missedToday: number;
    adherenceRate: number;
    weeklyAdherence: number[];
    lastTaken?: string;
    upcomingDoses: Array<{ time: string; medicineName: string }>;
    recentHistory: Array<{ status: string; medicineName: string; dispensedAt: string }>;
    medicineBreakdown: MedicineStats[];
}

const CareMonitoring: React.FC = () => {
    const history = useHistory();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [patients, setPatients] = useState<Patient[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
    const [stats, setStats] = useState<PatientStats | null>(null);
    const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('week');
    const [monitoringData, setMonitoringData] = useState<any[]>([]);

    // Status Modal State
    const [modalOpen, setModalOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState<{ type: 'success' | 'error' | 'warning', title: string, message: string }>({
        type: 'success',
        title: '',
        message: ''
    });

    const showStatus = (type: 'success' | 'error' | 'warning', title: string, message: string) => {
        setModalConfig({ type, title, message });
        setModalOpen(true);
    };

    useEffect(() => {
        loadPatients();
    }, []);

    useEffect(() => {
        if (selectedPatient) {
            loadPatientData(selectedPatient.id);
        }
    }, [selectedPatient, selectedPeriod]);

    const loadPatients = async () => {
        try {
            const res = await api.get("/patients");
            setPatients(res.data);
        } catch (err) {
            console.error("Error cargando pacientes:", err);
        } finally {
            setLoading(false);
        }
    };

    const loadPatientData = async (patientId: number) => {
        const cacheKey = `monitoring_data_${patientId}_${selectedPeriod}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            const { stats: s, data: d, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < 60000) { // 1 minuto de cache para monitoreo
                setStats(s);
                setMonitoringData(d);
                setLoading(false);
            }
        }

        if (!cached) setLoading(true);

        try {
            const days = selectedPeriod === 'today' ? 1 : selectedPeriod === 'week' ? 7 : 30;

            const [historyRes, medicinesRes, remindersRes, monitoringRes] = await Promise.all([
                api.get(`/patients/${patientId}/history?days=${days}`).catch(() => ({ data: [] })),
                api.get(`/patients/${patientId}/medicines`).catch(() => ({ data: [] })),
                api.get(`/patients/${patientId}/reminders`).catch(() => ({ data: [] })),
                api.get(`/patients/${patientId}/daily-monitoring`).catch(() => ({ data: [] }))
            ]);

            const history = historyRes.data || [];
            const medicines = medicinesRes.data || [];
            const reminders = remindersRes.data || [];

            // Calcular estadísticas generales
            const completed = history.filter((h: any) => h.status === 'TAKEN' || h.status === 'DISPENSED').length;
            const missed = history.filter((h: any) => h.status === 'MISSED').length;
            const total = completed + missed;
            const adherenceRate = total > 0 ? Math.round((completed / total) * 100) : 100;

            // Desglose por medicamento
            const medicineBreakdown: MedicineStats[] = medicines.map((med: any) => {
                const medHistory = history.filter((h: any) => h.medicineId === med.id);
                const medTaken = medHistory.filter((h: any) => h.status === 'TAKEN' || h.status === 'DISPENSED').length;
                const medMissed = medHistory.filter((h: any) => h.status === 'MISSED').length;
                const medTotal = medTaken + medMissed;
                return {
                    id: med.id,
                    name: med.name,
                    dosage: med.dosage,
                    taken: medTaken,
                    missed: medMissed,
                    total: medTotal,
                    adherence: medTotal > 0 ? Math.round((medTaken / medTotal) * 100) : 100
                };
            });

            // Weekly Adherence Data
            const weeklyAdherence = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dayStr = d.toDateString();

                const dayHistory = history.filter((h: any) => new Date(h.dispensedAt).toDateString() === dayStr);
                const dayTaken = dayHistory.filter((h: any) => h.status === 'TAKEN' || h.status === 'DISPENSED').length;
                const dayTotal = dayHistory.length;

                weeklyAdherence.push(dayTotal > 0 ? Math.round((dayTaken / dayTotal) * 100) : 0);
            }

            const lastTaken = history.length > 0
                ? new Date(history[0].dispensedAt).toLocaleString('es-ES', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                })
                : undefined;

            const newStats: PatientStats = {
                totalMedicines: medicines.length,
                totalReminders: reminders.length,
                completedToday: completed,
                missedToday: missed,
                adherenceRate,
                weeklyAdherence,
                lastTaken,
                upcomingDoses: reminders.slice(0, 3).map((r: any) => ({
                    time: r.time,
                    medicineName: r.medicineName || (r.medicine?.name)
                })),
                recentHistory: history.slice(0, 5).map((h: any) => ({
                    status: h.status,
                    medicineName: h.medicine?.name || 'Medicina',
                    dispensedAt: new Date(h.dispensedAt).toLocaleString('es-ES', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                    })
                })),
                medicineBreakdown
            };

            setStats(newStats);
            const mData = monitoringRes.data || [];
            setMonitoringData(mData);

            sessionStorage.setItem(cacheKey, JSON.stringify({
                stats: newStats,
                data: mData,
                timestamp: Date.now()
            }));

        } catch (err) {
            console.error("Error loading stats:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleContact = () => {
        if (!selectedPatient?.emergencyPhone) {
            showStatus('warning', 'Sin contacto', 'El paciente no tiene un número de emergencia registrado.');
            return;
        }

        // Limpiamos todo lo que no sea número
        let cleanPhone = selectedPatient.emergencyPhone.replace(/\D/g, '');

        // Si no tiene el código de Ecuador (593), lo agregamos
        if (!cleanPhone.startsWith('593')) {
            // Si empieza con 0 (muy común en Ecuador), lo quitamos antes de poner el 593
            if (cleanPhone.startsWith('0')) {
                cleanPhone = cleanPhone.substring(1);
            }
            cleanPhone = '593' + cleanPhone;
        }

        const message = encodeURIComponent(`Hola ${selectedPatient.name}, soy tu cuidador 👋. ¿Cómo te encuentras?`);
        window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
    };

    if (loading && !selectedPatient) {
        return (
            <IonPage>
                <IonContent fullscreen className="care-page">
                    <div className="center-flex" style={{ height: '100%' }}>
                        <IonSpinner name="crescent" color="primary" />
                    </div>
                </IonContent>
            </IonPage>
        );
    }

    // --- SELECCION DE PACIENTE ---
    if (!selectedPatient) {
        return (
            <IonPage>
                <IonContent fullscreen className="care-page">
                    <div className="care-bubble b1" />
                    <div className="care-bubble b2" />
                    <div className="care-container fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <div>
                                <h1 className="care-title" style={{ margin: 0 }}>Monitor de Rendimiento</h1>
                                <p className="care-subtitle" style={{ margin: 0 }}>Elige un paciente para ver su historial detallado</p>
                            </div>
                            <div
                                onClick={() => history.push("/care/profile")}
                                style={{
                                    width: '45px',
                                    height: '45px',
                                    borderRadius: '15px',
                                    overflow: 'hidden',
                                    border: '2px solid white',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    cursor: 'pointer',
                                    flexShrink: 0
                                }}
                            >
                                <img
                                    src={user?.photoUrl || "https://api.dicebear.com/7.x/avataaars/svg?seed=Anthony"}
                                    alt="Perfil"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            </div>
                        </div>

                        <div className="patient-selector-grid-pro">
                            {patients.map(p => (
                                <div key={p.id} className="patient-card-pro" onClick={() => setSelectedPatient(p)}>
                                    <div className="pro-avatar">
                                        {p.user?.photoUrl ? (
                                            <img src={p.user.photoUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            p.name.charAt(0)
                                        )}
                                    </div>
                                    <div className="pro-info">
                                        <h3>{p.name}</h3>
                                        <p>{p.condition || 'Sin condición reportada'}</p>
                                        <div className="pro-tags">
                                            <span className="pro-tag">{p.age || '?'} años</span>
                                            <span className={`pro-tag ${p.userId ? 'linked' : 'pending'}`}>
                                                {p.userId ? 'Conectado' : 'Sin vincular'}
                                            </span>
                                        </div>
                                    </div>
                                    <IonIcon icon={chevronForward} className="pro-arrow" />
                                </div>
                            ))}
                        </div>

                        {patients.length === 0 && (
                            <div className="empty-state-pro">
                                <IonIcon icon={person} />
                                <p>No hay pacientes para monitorear</p>
                            </div>
                        )}
                    </div>
                </IonContent>
            </IonPage>
        );
    }

    // --- DASHBOARD INDIVIDUAL ---
    return (
        <IonPage>
            <IonContent fullscreen className="care-page">
                <div className="care-bubble b1" />
                <div className="care-bubble b2" />

                <div className="care-container fade-in">
                    <div className="monitoring-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <button className="pro-back-btn" onClick={() => setSelectedPatient(null)}>
                            <IonIcon icon={arrowBack} /> Volver
                        </button>
                        <div
                            onClick={() => history.push("/care/profile")}
                            style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                border: '2px solid white',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                cursor: 'pointer'
                            }}
                        >
                            <img
                                src={user?.photoUrl || "https://api.dicebear.com/7.x/avataaars/svg?seed=Anthony"}
                                alt="Perfil"
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                        </div>
                    </div>

                    <div className="pro-header-profile">
                        <div className="pro-avatar-lg">
                            {selectedPatient.user?.photoUrl ? (
                                <img src={selectedPatient.user.photoUrl} alt={selectedPatient.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                                selectedPatient.name.charAt(0)
                            )}
                        </div>
                        <div className="pro-header-text">
                            <h2>{selectedPatient.name}</h2>
                            <p>{selectedPatient.condition || 'Monitoreo de Salud'}</p>
                        </div>
                        <div className="pro-adherence-orbit">
                            <div className="orbit-value">{stats?.adherenceRate || 0}%</div>
                            <div className="orbit-label">Cumplimiento</div>
                            <button
                                onClick={handleContact}
                                style={{
                                    marginTop: '8px',
                                    background: 'rgba(255, 255, 255, 0.2)',
                                    border: '1px solid rgba(255,255,255,0.4)',
                                    borderRadius: '20px',
                                    padding: '4px 12px',
                                    color: 'white',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}
                            >
                                📞 Contactar
                            </button>
                        </div>
                    </div>

                    <div className="pro-period-switcher">
                        {(['today', 'week', 'month'] as const).map(p => (
                            <button
                                key={p}
                                className={selectedPeriod === p ? 'active' : ''}
                                onClick={() => setSelectedPeriod(p)}
                            >
                                {p === 'today' ? 'Hoy' : p === 'week' ? '7 Días' : '30 Días'}
                            </button>
                        ))}
                    </div>

                    <div className="pro-stats-grid">
                        <div className="pro-stat-card">
                            <div className="stat-icon-wrap success"><IonIcon icon={checkmarkCircle} /></div>
                            <div className="stat-data">
                                <span className="val">{stats?.completedToday || 0}</span>
                                <span className="lbl">Suministradas</span>
                            </div>
                        </div>
                        <div className="pro-stat-card">
                            <div className="stat-icon-wrap alert"><IonIcon icon={closeCircle} /></div>
                            <div className="stat-data">
                                <span className="val">{stats?.missedToday || 0}</span>
                                <span className="lbl">Omitidas</span>
                            </div>
                        </div>
                    </div>

                    {/* NUEVO: Tabla de Monitoreo Diario */}
                    <div className="pro-section-card" style={{ marginTop: '20px' }}>
                        <h3 className="pro-card-title" style={{
                            color: 'var(--primary)',
                            marginBottom: '15px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <span>
                                <IonIcon icon={calendar} style={{ marginRight: '8px' }} />
                                Cronograma de Hoy
                            </span>
                            <button
                                onClick={() => loadPatientData(selectedPatient.id)}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--primary)',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '5px'
                                }}
                            >
                                <IonIcon icon={refresh} style={{ fontSize: '1.2rem' }} />
                                <span style={{ fontSize: '0.7rem', marginLeft: '4px', fontWeight: 600 }}>ACTUALIZAR</span>
                            </button>
                        </h3>
                        <div className="pro-pill-table" style={{
                            background: 'rgba(255, 255, 255, 0.03)',
                            backdropFilter: 'blur(10px)',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            borderRadius: '24px',
                            padding: '20px',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
                        }}>
                            <div className="pill-header" style={{
                                display: 'flex',
                                fontWeight: 800,
                                fontSize: '0.75rem',
                                opacity: 0.4,
                                marginBottom: '16px',
                                padding: '0 12px',
                                textTransform: 'uppercase',
                                letterSpacing: '2px'
                            }}>
                                <span style={{ flex: 1.2 }}>HORA</span>
                                <span style={{ flex: 2.5 }}>MEDICINA</span>
                                <span style={{ flex: 1, textAlign: 'right' }}>ESTADO</span>
                            </div>
                            {monitoringData.map((item, idx) => (
                                <div key={idx} className="pill-row" style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '16px 12px',
                                    marginBottom: '8px',
                                    borderRadius: '16px',
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    borderBottom: 'none',
                                    transition: 'all 0.3s ease',
                                    animation: `fadeInUp 0.5s ease forwards ${idx * 0.12}s`,
                                    opacity: 0,
                                    transform: 'translateY(10px)'
                                }}>
                                    <div style={{
                                        flex: 1.2,
                                        fontWeight: 900,
                                        color: 'var(--primary)',
                                        fontSize: '1.2rem',
                                        fontFamily: 'Outfit, sans-serif'
                                    }}>{item.time}</div>
                                    <div style={{ flex: 2.5 }}>
                                        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: '#fff' }}>{item.medicineName}</div>
                                        <div style={{ fontSize: '0.8rem', opacity: 0.5, fontWeight: 500 }}>{item.dosage}</div>
                                    </div>
                                    <div style={{ flex: 1, textAlign: 'right' }}>
                                        {item.status === 'COMPLETED' ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                <IonIcon icon={checkmarkCircle} style={{ color: '#4ade80', fontSize: '1.8rem', filter: 'drop-shadow(0 0 8px rgba(74, 222, 128, 0.3))' }} />
                                                <span style={{ fontSize: '0.6rem', color: '#4ade80', fontWeight: 800, marginTop: '2px' }}>ENTREGADA</span>
                                            </div>
                                        ) : item.status === 'OMITTED' ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                <IonIcon icon={closeCircle} style={{ color: '#f87171', fontSize: '1.8rem', filter: 'drop-shadow(0 0 8px rgba(248, 113, 113, 0.3))' }} />
                                                <span style={{ fontSize: '0.6rem', color: '#f87171', fontWeight: 800, marginTop: '2px' }}>OMITIDA</span>
                                            </div>
                                        ) : item.status === 'PROCESSING' ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                <div className="processing-indicator">
                                                    <IonIcon icon={fitness} style={{ color: '#fb923c', fontSize: '1.8rem', filter: 'drop-shadow(0 0 8px rgba(251, 146, 60, 0.3))' }} />
                                                </div>
                                                <span style={{ fontSize: '0.6rem', color: '#fb923c', fontWeight: 800, marginTop: '2px' }}>ESPERANDO MANO</span>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                <IonIcon icon={time} style={{ color: '#fbbf24', fontSize: '1.8rem', filter: 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.3))' }} />
                                                <span style={{ fontSize: '0.6rem', color: '#fbbf24', fontWeight: 800, marginTop: '2px' }}>PENDIENTE</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {monitoringData.length === 0 && (
                                <div style={{ textAlign: 'center', padding: '30px 10px', opacity: 0.5, fontStyle: 'italic' }}>
                                    No hay dosis programadas para hoy
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Grafico de Barras */}
                    <div className="pro-section-card">
                        <h3 className="pro-card-title"><IonIcon icon={barChart} /> Rendimiento Semanal</h3>
                        <div className="pro-chart-bars">
                            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((day, i) => (
                                <div key={i} className="chart-col">
                                    <div className="bar-track">
                                        <div
                                            className="bar-fill"
                                            style={{
                                                height: `${stats?.weeklyAdherence[i] || 0}%`,
                                                background: (stats?.weeklyAdherence[i] || 0) > 80 ? 'var(--success)' : (stats?.weeklyAdherence[i] || 0) > 50 ? 'var(--warning)' : 'var(--danger)'
                                            }}
                                        ></div>
                                    </div>
                                    <span className="day-name">{day}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Desglose de Pastillas */}
                    <div className="pro-section-card">
                        <h3 className="pro-card-title"><IonIcon icon={list} /> Control de Suministros</h3>
                        <div className="pro-pill-table">
                            {stats?.medicineBreakdown.map(med => (
                                <div key={med.id} className="pill-row">
                                    <div className="pill-info">
                                        <span className="pill-name">{med.name}</span>
                                        <span className="pill-dose">{med.dosage}</span>
                                    </div>
                                    <div className="pill-metrics">
                                        <div className="metric">
                                            <span className="m-val">{med.taken}</span>
                                            <span className="m-lbl">Ok</span>
                                        </div>
                                        <div className="metric">
                                            <span className="m-val fail">{med.missed}</span>
                                            <span className="m-lbl">Fail</span>
                                        </div>
                                    </div>
                                    <div className="pill-progress">
                                        <div className="p-track">
                                            <div className="p-fill" style={{ width: `${med.adherence}%` }}></div>
                                        </div>
                                        <span className="p-val">{med.adherence}%</span>
                                    </div>
                                </div>
                            ))}
                            {(!stats || stats.medicineBreakdown.length === 0) && (
                                <div className="no-pills">No hay medicamentos registrados</div>
                            )}
                        </div>
                    </div>

                    {/* Historial Timeline */}
                    <div className="pro-section-card">
                        <h3 className="pro-card-title"><IonIcon icon={calendar} /> Actividad Reciente</h3>
                        <div className="pro-timeline">
                            {stats?.recentHistory.map((h, i) => (
                                <div key={i} className={`timeline-item ${h.status.toLowerCase()}`}>
                                    <div className="tm-icon">
                                        <IonIcon icon={h.status === 'MISSED' ? closeCircle : checkmarkCircle} />
                                    </div>
                                    <div className="tm-content">
                                        <div className="tm-top">
                                            <strong>{h.medicineName}</strong>
                                            <span>{h.dispensedAt}</span>
                                        </div>
                                        <p>{h.status === 'MISSED' ? 'Dosis perdida' : 'Suministro exitoso'}</p>
                                    </div>
                                </div>
                            ))}
                            {(!stats || stats.recentHistory.length === 0) && (
                                <p className="no-history">Sin actividad reciente registrada</p>
                            )}
                        </div>
                    </div>

                </div>
            </IonContent>
        </IonPage>
    );
};

export default CareMonitoring;
