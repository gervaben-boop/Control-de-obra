"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Task = {
  id: string;
  obra: string;
  piso: string;
  unidad: string;
  ambiente: string;
  rubro: string;
  descripcion: string;
  responsable: string;
  prioridad: "Baja" | "Media" | "Alta";
  estado: "Pendiente" | "Asignada" | "Terminada" | "Verificada";
  fechaLimite: string;
};

const emptyTask: Task = {
  id: "",
  obra: "Torre Pellegrini",
  piso: "",
  unidad: "",
  ambiente: "",
  rubro: "Albañilería",
  descripcion: "",
  responsable: "",
  prioridad: "Media",
  estado: "Pendiente",
  fechaLimite: ""
};

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState<Task>(emptyTask);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [filter, setFilter] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadTasks();
  }, []);

  async function loadTasks() {
    setLoading(true);
    const { data, error } = await supabase
      .from("tareas")
      .select(`
        id,
        rubro,
        descripcion,
        prioridad,
        estado,
        fecha_limite,
        obras ( nombre ),
        sectores ( piso, unidad, ambiente ),
        usuarios ( nombre )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error);
      setMessage("No se pudieron cargar las tareas desde Supabase.");
      setLoading(false);
      return;
    }

    const mapped: Task[] = (data || []).map((row: any) => ({
      id: row.id,
      obra: row.obras?.nombre || "",
      piso: row.sectores?.piso || "",
      unidad: row.sectores?.unidad || "",
      ambiente: row.sectores?.ambiente || "",
      rubro: row.rubro || "",
      descripcion: row.descripcion || "",
      responsable: row.usuarios?.nombre || "",
      prioridad: row.prioridad || "Media",
      estado: row.estado || "Pendiente",
      fechaLimite: row.fecha_limite || ""
    }));

    setTasks(mapped);
    setLoading(false);
  }

  const counts = useMemo(() => ({
    pendientes: tasks.filter(t => t.estado === "Pendiente").length,
    asignadas: tasks.filter(t => t.estado === "Asignada").length,
    terminadas: tasks.filter(t => t.estado === "Terminada").length,
    verificadas: tasks.filter(t => t.estado === "Verificada").length
  }), [tasks]);

  const visibleTasks = filter === "Todos"
    ? tasks
    : tasks.filter(t => t.estado === filter);

  function update<K extends keyof Task>(key: K, value: Task[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function getOrCreateObra(nombre: string) {
    const clean = nombre.trim();
    if (!clean) return null;

    const { data: existing } = await supabase
      .from("obras")
      .select("id")
      .eq("nombre", clean)
      .limit(1)
      .maybeSingle();

    if (existing) return existing.id;

    const { data, error } = await supabase
      .from("obras")
      .insert({ nombre: clean })
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  }

  async function getOrCreateUsuario(nombre: string) {
    const clean = nombre.trim();
    if (!clean) return null;

    const { data: existing } = await supabase
      .from("usuarios")
      .select("id")
      .eq("nombre", clean)
      .limit(1)
      .maybeSingle();

    if (existing) return existing.id;

    const { data, error } = await supabase
      .from("usuarios")
      .insert({ nombre: clean, rol: "Responsable" })
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  }

  async function getOrCreateSector(obraId: string, piso: string, unidad: string, ambiente: string) {
    const { data: existing } = await supabase
      .from("sectores")
      .select("id")
      .eq("obra_id", obraId)
      .eq("piso", piso || "")
      .eq("unidad", unidad || "")
      .eq("ambiente", ambiente || "")
      .limit(1)
      .maybeSingle();

    if (existing) return existing.id;

    const { data, error } = await supabase
      .from("sectores")
      .insert({
        obra_id: obraId,
        piso: piso || "",
        unidad: unidad || "",
        ambiente: ambiente || ""
      })
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  }

  async function saveTask(e: FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!form.descripcion.trim()) {
      setMessage("Escribí una descripción para la tarea.");
      return;
    }

    try {
      const obraId = await getOrCreateObra(form.obra);
      if (!obraId) {
        setMessage("Ingresá una obra.");
        return;
      }

      const responsableId = await getOrCreateUsuario(form.responsable);
      const sectorId = await getOrCreateSector(
        obraId,
        form.piso,
        form.unidad,
        form.ambiente
      );

      const { error } = await supabase
        .from("tareas")
        .insert({
          obra_id: obraId,
          sector_id: sectorId,
          rubro: form.rubro,
          descripcion: form.descripcion.trim(),
          responsable_id: responsableId,
          prioridad: form.prioridad,
          estado: "Pendiente",
          fecha_limite: form.fechaLimite || null
        });

      if (error) throw error;

      setForm({ ...emptyTask, obra: form.obra });
      setAiText("");
      setMessage("Tarea guardada en Supabase.");
      await loadTasks();
    } catch (error) {
      console.error(error);
      setMessage("No se pudo guardar la tarea en Supabase.");
    }
  }

  async function createWithAI() {
    if (!aiText.trim()) return;
    setAiLoading(true);
    setMessage("");

    try {
      const r = await fetch("/api/ai-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: aiText })
      });

      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Error");

      setForm(prev => ({
        ...prev,
        ...data,
        id: "",
        obra: data.obra || prev.obra,
        prioridad: data.prioridad || "Media",
        estado: "Pendiente"
      }));
    } catch (err) {
      console.error(err);
      setMessage("No se pudo usar IA.");
    } finally {
      setAiLoading(false);
    }
  }

  async function cycleState(id: string) {
    const order: Task["estado"][] = ["Pendiente", "Asignada", "Terminada", "Verificada"];
    const task = tasks.find(t => t.id === id);
    if (!task) return;

    const idx = order.indexOf(task.estado);
    const next = order[Math.min(idx + 1, order.length - 1)];

    const { error } = await supabase
      .from("tareas")
      .update({ estado: next, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      console.error(error);
      setMessage("No se pudo actualizar el estado.");
      return;
    }

    await loadTasks();
  }

  async function deleteTask(id: string) {
    const { error } = await supabase
      .from("tareas")
      .delete()
      .eq("id", id);

    if (error) {
      console.error(error);
      setMessage("No se pudo eliminar la tarea.");
      return;
    }

    await loadTasks();
  }

  return (
    <main className="shell">
      <header className="topbar">
        <h1>Control de Obra</h1>
        <small>Gestión de tareas y pendientes · Supabase conectado</small>
      </header>

      <div className="container">
        <section className="stats">
          <div className="stat"><strong>{counts.pendientes}</strong>Pendientes</div>
          <div className="stat"><strong>{counts.asignadas}</strong>Asignadas</div>
          <div className="stat"><strong>{counts.terminadas}</strong>Terminadas</div>
          <div className="stat"><strong>{counts.verificadas}</strong>Verificadas</div>
        </section>

        {message && (
          <div className="card" style={{ marginBottom: 14 }}>
            {message}
          </div>
        )}

        <section className="grid">
          <div className="card">
            <h2>Nueva tarea</h2>

            <div className="aiBox">
              <strong>Crear con IA</strong>
              <textarea
                placeholder='Ej: "Piso 8 dpto B, cocina, faltan 2 tomas, electricidad, asignar a Juan, prioridad alta."'
                value={aiText}
                onChange={e => setAiText(e.target.value)}
              />
              <button className="ai" type="button" onClick={createWithAI}>
                {aiLoading ? "Interpretando..." : "Completar formulario con IA"}
              </button>
            </div>

            <form onSubmit={saveTask}>
              <label>Obra</label>
              <input value={form.obra} onChange={e => update("obra", e.target.value)} />

              <label>Piso / Nivel</label>
              <input value={form.piso} onChange={e => update("piso", e.target.value)} />

              <label>Unidad / Sector</label>
              <input value={form.unidad} onChange={e => update("unidad", e.target.value)} />

              <label>Ambiente</label>
              <input value={form.ambiente} onChange={e => update("ambiente", e.target.value)} />

              <label>Rubro</label>
              <select value={form.rubro} onChange={e => update("rubro", e.target.value)}>
                <option>Albañilería</option>
                <option>Electricidad</option>
                <option>Sanitaria</option>
                <option>Pintura</option>
                <option>Carpintería</option>
                <option>Gas</option>
                <option>Climatización</option>
                <option>Otros</option>
              </select>

              <label>Descripción</label>
              <textarea value={form.descripcion} onChange={e => update("descripcion", e.target.value)} />

              <label>Responsable</label>
              <input value={form.responsable} onChange={e => update("responsable", e.target.value)} />

              <label>Prioridad</label>
              <select
                value={form.prioridad}
                onChange={e => update("prioridad", e.target.value as Task["prioridad"])}
              >
                <option>Baja</option>
                <option>Media</option>
                <option>Alta</option>
              </select>

              <label>Fecha límite</label>
              <input type="date" value={form.fechaLimite} onChange={e => update("fechaLimite", e.target.value)} />

              <div className="actions">
                <button className="primary">Guardar tarea</button>
              </div>
            </form>
          </div>

          <div className="card">
            <h2>Tareas</h2>

            <div className="toolbar">
              <select value={filter} onChange={e => setFilter(e.target.value)}>
                <option>Todos</option>
                <option>Pendiente</option>
                <option>Asignada</option>
                <option>Terminada</option>
                <option>Verificada</option>
              </select>

              <button className="secondary" onClick={loadTasks}>
                Actualizar
              </button>
            </div>

            {loading && <div className="empty">Cargando tareas...</div>}

            {!loading && visibleTasks.length === 0 && (
              <div className="empty">Todavía no hay tareas cargadas.</div>
            )}

            {visibleTasks.map(task => (
              <div className="task" key={task.id}>
                <div className="taskHeader">
                  <div className="taskTitle">{task.descripcion}</div>
                  <span className="badge">{task.estado}</span>
                </div>

                <div className="meta">
                  {task.obra} · Piso {task.piso || "-"} · {task.unidad || "Sin unidad"}<br/>
                  {task.ambiente ? `${task.ambiente} · ` : ""}
                  {task.rubro} · {task.prioridad} · Responsable: {task.responsable || "Sin asignar"}
                </div>

                <div className="actions">
                  {task.estado !== "Verificada" && (
                    <button className="secondary" onClick={() => cycleState(task.id)}>
                      Avanzar estado
                    </button>
                  )}

                  <button className="secondary" onClick={() => deleteTask(task.id)}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
