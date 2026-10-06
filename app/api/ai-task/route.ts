import OpenAI from "openai";
import { NextResponse } from "next/server";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "Falta OPENAI_API_KEY" },
        { status: 500 }
      );
    }

    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Texto inválido" },
        { status: 400 }
      );
    }

    const response = await client.responses.create({
      model: "gpt-6-luna",
      input: [
        {
          role: "system",
          content:
            "Sos un asistente para gestión de obra en Argentina. Extraé datos de una observación de obra. " +
            "Respondé SOLAMENTE JSON válido, sin markdown, con estas claves exactas: " +
            "obra, piso, unidad, ambiente, rubro, descripcion, responsable, prioridad. " +
            "prioridad debe ser Baja, Media o Alta. Si un dato no aparece, usar string vacío. " +
            "Normalizá la descripción para que sea breve y clara.",
        },
        {
          role: "user",
          content: text,
        },
      ],
    });

    const raw = response.output_text.trim();
    const parsed = JSON.parse(raw);

    return NextResponse.json(parsed);
  } catch (error: any) {
    console.error("ERROR OPENAI:", error);

    return NextResponse.json(
      {
        error: error?.message || "No se pudo interpretar la tarea",
        status: error?.status || null,
        code: error?.code || null,
      },
      { status: 500 }
    );
  }
}