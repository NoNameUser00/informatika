import { useEffect, useState } from 'react';
import { getClient, type Role } from '../lib/auth/client';
import { approveTeacherByEmail, createClass, resolveDuplicate, type ClassInfo } from '../lib/auth/classes';

// Учитель: создать класс -> показать код; списки; разбор дублей. Админ: назначить учителя.
interface Member {
  student_id: string;
  norm_fio: string;
  display_fio: string;
  status: string;
}

export default function ClassManager({ role }: { role: Role }) {
  const [name, setName] = useState('');
  const [classes, setClasses] = useState<(ClassInfo & { created_at?: string })[]>([]);
  const [members, setMembers] = useState<Record<string, Member[]>>({});
  const [msg, setMsg] = useState('');
  const [email, setEmail] = useState('');

  async function load() {
    const c = getClient();
    if (!c) return;
    const { data } = await c.from('classes').select('id,code,name,created_at').order('created_at');
    setClasses((data as ClassInfo[]) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function loadMembers(classId: string) {
    const c = getClient();
    if (!c) return;
    const { data } = await c
      .from('class_members')
      .select('student_id,norm_fio,display_fio,status')
      .eq('class_id', classId)
      .order('display_fio');
    setMembers((m) => ({ ...m, [classId]: (data as Member[]) ?? [] }));
  }

  async function goCreate() {
    setMsg('');
    try {
      const r = await createClass(name);
      setName('');
      setMsg(`Класс создан. Код: ${r.code} — продиктуй ученикам.`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Не создан.');
    }
  }

  async function goApprove() {
    setMsg('');
    try {
      const uid = await approveTeacherByEmail(email);
      setEmail('');
      setMsg(`Учитель назначен (id ${uid.slice(0, 8)}…).`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Не назначено.');
    }
  }

  async function goResolve(classId: string, keep: string, drop: string) {
    setMsg('');
    try {
      await resolveDuplicate(keep, drop);
      await loadMembers(classId);
      setMsg('Дубль разобран.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Не разобрано.');
    }
  }

  return (
    <div className="card">
      <h2>Мои классы</h2>
      <p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название, напр. 8А" aria-label="Название класса" />{' '}
        <button className="btn secondary" onClick={() => void goCreate()}>Создать класс (код выдаст сервер)</button>
      </p>
      {classes.map((cl) => {
        const ms = members[cl.id];
        const dups = (ms ?? []).filter((m) => m.status === 'duplicate');
        const act = (ms ?? []).filter((m) => m.status === 'active');
        return (
          <div key={cl.id}>
            <p><strong>{cl.name}</strong> · код <strong>{cl.code}</strong> · учеников: {act.length}{dups.length > 0 && <span className="bad"> · спорных: {dups.length}</span>}{' '}
              <button className="btn secondary" onClick={() => void loadMembers(cl.id)}>Обновить список</button>
            </p>
            {ms && (
              <ul>
                {act.map((m) => (
                  <li key={m.student_id}>{m.display_fio}</li>
                ))}
                {dups.map((m) => (
                  <li key={m.student_id}>
                    <span className="bad">{m.display_fio} (спорное — то же ФИО уже есть)</span>{' '}
                    {act.filter((a) => a.norm_fio === m.norm_fio).map((a) => (
                      <button key={a.student_id} className="btn secondary" onClick={() => void goResolve(cl.id, a.student_id, m.student_id)}>
                        Оставить первое
                      </button>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
      {role === 'admin' && (
        <p>
          <strong>Админ:</strong>{' '}
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Почта учителя" aria-label="Почта учителя" />{' '}
          <button className="btn secondary" onClick={() => void goApprove()}>Назначить учителем</button>
        </p>
      )}
      {msg && <p className="muted">{msg}</p>}
    </div>
  );
}
