"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  courseId: string;
  onSuccess?: () => void;
};

type StudentImport = {
  npm: string;
  name: string;
};

export default function ImportStudentsTxt({
  courseId,
  onSuccess,
}: Props) {
  const supabase = createClient();

  const inputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<StudentImport[]>([]);
  const [message, setMessage] = useState("");

  // Membaca isi TXT
  const parseTxt = (text: string): StudentImport[] => {
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line !== "");

    const students: StudentImport[] = [];

    for (const line of lines) {
      // Mendukung:
      // 22316009|NUR RAHMATULLAH
      // 22316009;NUR RAHMATULLAH
      // 22316009<TAB>NUR RAHMATULLAH
      // 22316009,NUR RAHMATULLAH

      const parts = line
        .split(/\||;|\t|,/)
        .map((item) => item.trim());

      if (parts.length < 2) {
        continue;
      }

      const npm = parts[0];
      const name = parts.slice(1).join(" ").trim();

      // Lewati header
      if (
        npm.toLowerCase() === "npm" ||
        name.toLowerCase() === "nama" ||
        name.toLowerCase() === "nama mahasiswa"
      ) {
        continue;
      }

      if (!npm || !name) {
        continue;
      }

      students.push({
        npm,
        name,
      });
    }

    // Hilangkan NPM yang duplikat di dalam file
    return students.filter(
      (student, index, self) =>
        index === self.findIndex((item) => item.npm === student.npm)
    );
  };

  // Ketika file dipilih
  const handleFile = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setMessage("");

    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".txt")) {
      setMessage("File harus berformat .txt");
      setPreview([]);
      return;
    }

    setFileName(file.name);

    try {
      const text = await file.text();

      const students = parseTxt(text);

      if (students.length === 0) {
        setMessage(
          "Tidak ada data mahasiswa yang dapat dibaca dari file."
        );
        setPreview([]);
        return;
      }

      setPreview(students);

      setMessage(
        `${students.length} mahasiswa berhasil dibaca dari file.`
      );
    } catch (error) {
      console.error(error);

      setMessage("Gagal membaca file.");
      setPreview([]);
    }
  };

  // Import ke Supabase
  const handleImport = async () => {
    if (!courseId) {
      setMessage("Pilih kelas terlebih dahulu.");
      return;
    }

    if (preview.length === 0) {
      setMessage("Pilih file TXT terlebih dahulu.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const dataToInsert = preview.map((student) => ({
        course_id: courseId,
        npm: student.npm,
        name: student.name,
      }));

      const { error } = await supabase
        .from("students")
        .upsert(dataToInsert, {
          onConflict: "course_id,npm",
        });

      if (error) {
        throw error;
      }

      setMessage(
        `${preview.length} mahasiswa berhasil diimport.`
      );

      setPreview([]);
      setFileName("");

      if (inputRef.current) {
        inputRef.current.value = "";
      }

      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error(error);

      setMessage(
        error?.message || "Terjadi kesalahan saat mengimport data."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPreview([]);
    setFileName("");
    setMessage("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Import Mahasiswa
        </h2>

        <p className="mt-1 text-sm text-gray-500">
          Import daftar mahasiswa menggunakan file TXT.
        </p>
      </div>

      {/* Format contoh */}
      <div className="mb-4 rounded-lg bg-gray-50 p-4">
        <p className="mb-2 text-sm font-medium text-gray-700">
          Format TXT:
        </p>

        <pre className="overflow-x-auto text-sm text-gray-600">
{`NPM|Nama Mahasiswa
22316009|NUR RAHMATULLAH
23316017|WIDYAWATI
25316001|ACHMED FAOZAN ADIPUTRA`}
        </pre>
      </div>

      {/* Upload */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".txt,text/plain"
          onChange={handleFile}
          className="block w-full max-w-md rounded-lg border border-gray-300 p-2 text-sm"
        />

        {fileName && (
          <span className="text-sm text-gray-500">
            {fileName}
          </span>
        )}
      </div>

      {/* Pesan */}
      {message && (
        <div className="mt-4 rounded-lg bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {message}
        </div>
      )}

      {/* Preview */}
      {preview.length > 0 && (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">
              Preview Data
            </h3>

            <span className="text-sm text-gray-500">
              {preview.length} mahasiswa
            </span>
          </div>

          <div className="max-h-80 overflow-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-100">
                <tr>
                  <th className="border-b px-4 py-3 text-left">
                    No
                  </th>

                  <th className="border-b px-4 py-3 text-left">
                    NPM
                  </th>

                  <th className="border-b px-4 py-3 text-left">
                    Nama Mahasiswa
                  </th>
                </tr>
              </thead>

              <tbody>
                {preview.map((student, index) => (
                  <tr
                    key={`${student.npm}-${index}`}
                    className="border-b last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      {index + 1}
                    </td>

                    <td className="px-4 py-3 font-medium">
                      {student.npm}
                    </td>

                    <td className="px-4 py-3">
                      {student.name}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tombol */}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleImport}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Mengimport..."
                : `Import ${preview.length} Mahasiswa`}
            </button>

            <button
              type="button"
              onClick={handleCancel}
              disabled={loading}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}