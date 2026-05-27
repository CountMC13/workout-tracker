import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Trash2, Video, X, Plus } from 'lucide-react';
import {
  db,
  createExercise,
  updateExercise,
  deleteExercise,
  saveVideo,
  replaceVideo,
  removeVideo,
} from '../db';
import { MUSCLE_GROUPS, FREQUENCY_PRESETS, tagColor } from '../constants';

export default function ExerciseEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const editing = Boolean(id);
  const existing = useLiveQuery(() => (id ? db.exercises.get(id) : undefined), [id]);
  const existingVideo = useLiveQuery(
    () => (existing?.videoId ? db.videos.get(existing.videoId) : undefined),
    [existing?.videoId],
  );

  const [name, setName] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [frequency, setFrequency] = useState('');
  const [keyPoints, setKeyPoints] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  // Video chosen before the exercise exists (new-exercise flow).
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [loaded, setLoaded] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Populate the form once when editing an existing exercise.
  useEffect(() => {
    if (editing && existing && !loaded) {
      setName(existing.name);
      setSets(existing.sets != null ? String(existing.sets) : '');
      setReps(existing.reps);
      setFrequency(existing.frequency);
      setKeyPoints(existing.keyPoints);
      setNotes(existing.notes);
      setTags(existing.muscleGroups);
      setLoaded(true);
    }
  }, [editing, existing, loaded]);

  const allTags = [...new Set([...MUSCLE_GROUPS, ...tags])];

  const toggleTag = (tag: string) =>
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));

  const addCustomTag = () => {
    const t = customTag.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setCustomTag('');
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    if (editing && id) {
      await replaceVideo(id, file);
    } else {
      setPendingFile(file);
    }
  };

  const onSave = async () => {
    if (!name.trim()) {
      alert('Please enter an exercise name.');
      return;
    }
    const data = {
      name: name.trim(),
      sets: sets.trim() === '' ? null : Number(sets),
      reps: reps.trim(),
      frequency: frequency.trim(),
      keyPoints: keyPoints.trim(),
      notes: notes.trim(),
      muscleGroups: tags,
      videoId: existing?.videoId ?? null,
    };
    if (editing && id) {
      await updateExercise(id, data);
      navigate(`/physio/exercise/${id}`);
    } else {
      let videoId: string | null = null;
      if (pendingFile) videoId = await saveVideo(pendingFile);
      const newId = await createExercise({ ...data, videoId });
      navigate(`/physio/exercise/${newId}`);
    }
  };

  const onDelete = async () => {
    if (!id) return;
    if (confirm('Delete this exercise and its completion history? This cannot be undone.')) {
      await deleteExercise(id);
      navigate('/physio');
    }
  };

  const videoName = editing ? existingVideo?.name : pendingFile?.name;

  return (
    <div className="page">
      <header className="page-header">
        <button className="icon-btn" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1>{editing ? 'Edit exercise' : 'New exercise'}</h1>
      </header>

      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        <label className="field">
          <span>Exercise name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Foam roller shoulder mobility"
            autoFocus={!editing}
          />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Sets</span>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={sets}
              onChange={(e) => setSets(e.target.value)}
              placeholder="3"
            />
          </label>
          <label className="field">
            <span>Reps</span>
            <input
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              placeholder="10 or 30s hold"
            />
          </label>
        </div>

        <label className="field">
          <span>Frequency</span>
          <input
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            placeholder="Daily"
            list="freq-presets"
          />
          <datalist id="freq-presets">
            {FREQUENCY_PRESETS.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
        </label>

        <div className="field">
          <span>Muscle groups</span>
          <div className="tag-picker">
            {allTags.map((tag) => {
              const active = tags.includes(tag);
              const color = tagColor(tag);
              return (
                <button
                  type="button"
                  key={tag}
                  className={`tag-toggle ${active ? 'active' : ''}`}
                  style={active ? { background: color, borderColor: color, color: '#fff' } : undefined}
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          <div className="custom-tag">
            <input
              value={customTag}
              onChange={(e) => setCustomTag(e.target.value)}
              placeholder="Add custom tag"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomTag();
                }
              }}
            />
            <button type="button" className="btn-secondary" onClick={addCustomTag}>
              <Plus size={16} /> Add
            </button>
          </div>
        </div>

        <label className="field">
          <span>Key points</span>
          <textarea
            value={keyPoints}
            onChange={(e) => setKeyPoints(e.target.value)}
            placeholder="Form cues to remember"
            rows={3}
          />
        </label>

        <label className="field">
          <span>Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else"
            rows={3}
          />
        </label>

        <div className="field">
          <span>Video (MP4)</span>
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/*"
            hidden
            onChange={(e) => onPickFile(e.target.files?.[0])}
          />
          {videoName ? (
            <div className="video-file-row">
              <Video size={18} />
              <span className="video-file-name">{videoName}</span>
              <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()}>
                Replace
              </button>
              {editing && (
                <button
                  type="button"
                  className="icon-btn danger"
                  aria-label="Remove video"
                  onClick={() => id && removeVideo(id)}
                >
                  <X size={18} />
                </button>
              )}
            </div>
          ) : (
            <button type="button" className="btn-secondary full" onClick={() => fileRef.current?.click()}>
              <Video size={18} /> Import MP4 video
            </button>
          )}
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary full">
            {editing ? 'Save changes' : 'Create exercise'}
          </button>
          {editing && (
            <button type="button" className="btn-danger full" onClick={onDelete}>
              <Trash2 size={18} /> Delete exercise
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
