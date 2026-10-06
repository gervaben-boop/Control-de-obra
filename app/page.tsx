"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
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

type PhotoView = {
  id: string;
  tipo: string;
  path: string;
  signedUrl: string;
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
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [form, setForm] = useState<Task>(emptyTask);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [filter, setFilter] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [initialPhoto, setInitialPhoto] = useState<File | null>(null);
  const [photosByTask, setPhotosByTask] = useState<Record<string, PhotoView[]>>({});
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);

  const finalPhotoInputs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    async function initAuth() {
      const { data } = await supabase.auth.getSession();
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    }

    initAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (user) {
      loadTasks();
    } else {
      setTasks([]);
      setPhotosByTask({});
      setLoading(false);
    }
  }, [user]);

  async function signIn(e: FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) {
      console.error(error);
      setLoginError("Email o contraseña incorrectos.");
    }

    setLoginLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMessage("");
  }

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
    await loadAllPhotos(mapped.map(t => t.id));
    setLoading(false);
  }

  async function loadAllPhotos(taskIds: string[]) {
    if (taskIds.length === 0) {
      setPhotosByTask({});
      return;
    }

    const { data, error } = await supabase
      .from("fotos")
      .select("id, tarea_id, url, tipo")
      .in("tarea_id", taskIds)
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error);
      return;
    }

    const map: Record<string, PhotoView[]> = {};

    for (const photo of data || []) {
      const { data: signed } = await supabase.storage
        .from("tareas-fotos")
        .createSignedUrl(photo.url, 60 * 60);

      if (!map[photo.tarea_id]) map[photo.tarea_id] = [];

      map[photo.tarea_id].push({
        id: photo.id,
        tipo: photo.tipo || "Foto",
        path: photo.url,
        signedUrl: signed?.signedUrl || ""
      });
    }

    setPhotosByTask(map);
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

  function sanitizeFileName(name: string) {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_");
  }

  async function uploadPhoto(taskId: string, file: File, tipo: "Inicial" | "Final") {
    if (!user) throw new Error("Usuario no autenticado");

    if (!file.type.startsWith("image/")) {
      throw new Error("El archivo debe ser una imagen.");
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error("La imagen supera los 10 MB.");
    }

    const safeName = sanitizeFileName(file.name || "foto.jpg");
    const path = `${user.id}/${taskId}/${tipo.toLowerCase()}-${Date.now()}-${safeName}`;

    const { error: storageError } = await supabase.storage
      .from("tareas-fotos")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type
      });

    if (storageError) throw storageError;

    const { error: dbError } = await supabase
      .from("fotos")
      .insert({
        tarea_id: taskId,
        url: path,
        tipo
      });

    if (dbError) {
      await supabase.storage.from("tareas-fotos").remove([path]);
      throw dbError;
    }
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

      const { data: taskCreated, error } = await supabase
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
        })
        .select("id")
        .single();

      if (error) throw error;

      if (initialPhoto) {
        await uploadPhoto(taskCreated.id, initialPhoto, "Inicial");
      }

      setForm({ ...emptyTask, obra: form.obra });
      setAiText("");
      setInitialPhoto(null);
      setMessage("Tarea guardada correctamente.");
      await loadTasks();
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || "No se pudo guardar la tarea.");
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
      .update({
        estado: next,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) {
      console.error(error);
      setMessage("No se pudo actualizar el estado.");
      return;
    }

    await loadTasks();
  }

  async function handleFinalPhoto(taskId: string, file: File | null) {
    if (!file) return;

    setUploadingTaskId(taskId);
    setMessage("");

    try {
      await uploadPhoto(taskId, file, "Final");
      setMessage("Foto final guardada correctamente.");
      await loadTasks();
    } catch (error: any) {
      console.error(error);
      setMessage(error?.message || "No se pudo guardar la foto final.");
    } finally {
      setUploadingTaskId(null);
      const input = finalPhotoInputs.current[taskId];
      if (input) input.value = "";
    }
  }

  async function deleteTask(id: string) {
    const taskPhotos = photosByTask[id] || [];

    if (taskPhotos.length > 0) {
      await supabase.storage
        .from("tareas-fotos")
        .remove(taskPhotos.map(p => p.path));
    }

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

  if (authLoading) {
    return (
      <main className="shell">
        <div className="container">
          <div className="card">Cargando...</div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="shell">
        <header className="topbar">
          <h1>Control de Obra</h1>
          <small>Acceso al sistema</small>
        </header>

        <div className="container" style={{ maxWidth: 480 }}>
          <div className="card" style={{ marginTop: 40 }}>
            <h2>Iniciar sesión</h2>

            <form onSubmit={signIn}>
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />

              <label>Contraseña</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />

              {loginError && (
                <div style={{ marginTop: 12 }}>
                  {loginError}
                </div>
              )}

              <div className="actions">
                <button className="primary" disabled={loginLoading}>
                  {loginLoading ? "Ingresando..." : "Ingresar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap"
        }}>
          <div>
            <h1>Control de Obra</h1>
            <small>Gestión de tareas, pendientes y fotografías</small>
          </div>

          <div style={{ textAlign: "right" }}>
            <small style={{ display: "block", marginBottom: 6 }}>
              {user.email}
            </small>
            <button className="secondary" onClick={signOut}>
              Cerrar sesión
            </button>
          </div>
        </div>
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
              <input
                type="date"
                value={form.fechaLimite}
                onChange={e => update("fechaLimite", e.target.value)}
              />

              <label>Foto inicial (opcional)</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={e => setInitialPhoto(e.target.files?.[0] || null)}
              />

              {initialPhoto && (
                <div className="meta" style={{ marginTop: 6 }}>
                  Foto seleccionada: {initialPhoto.name}
                </div>
              )}

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

            {visibleTasks.map(task => {
              const photos = photosByTask[task.id] || [];

              return (
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

                  {photos.length > 0 && (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                      gap: 8,
                      marginTop: 12
                    }}>
                      {photos.map(photo => (
                        <div key={photo.id}>
                          <div className="meta" style={{ marginBottom: 4 }}>
                            {photo.tipo}
                          </div>
                          {photo.signedUrl && (
                            <a
                              href={photo.signedUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <img
                                src={photo.signedUrl}
                                alt={`Foto ${photo.tipo}`}
                                style={{
                                  width: "100%",
                                  height: 100,
                                  objectFit: "cover",
                                  borderRadius: 8,
                                  border: "1px solid #e2e6eb"
                                }}
                              />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="actions" style={{ flexWrap: "wrap" }}>
                    {task.estado !== "Verificada" && (
                      <button className="secondary" onClick={() => cycleState(task.id)}>
                        Avanzar estado
                      </button>
                    )}

                    <input
                      ref={el => {
                        finalPhotoInputs.current[task.id] = el;
                      }}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: "none" }}
                      onChange={e => handleFinalPhoto(task.id, e.target.files?.[0] || null)}
                    />

                    <button
                      className="secondary"
                      type="button"
                      disabled={uploadingTaskId === task.id}
                      onClick={() => finalPhotoInputs.current[task.id]?.click()}
                    >
                      {uploadingTaskId === task.id ? "Subiendo..." : "Agregar foto final"}
                    </button>

                    <button className="secondary" onClick={() => deleteTask(task.id)}>
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
