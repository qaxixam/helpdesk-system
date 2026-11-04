import mongoose, { Schema, Model } from "mongoose";

/**
 * Atomic sequence counter. `findOneAndUpdate + $inc` MongoDB mein atomic hai,
 * is liye do requests ek saath aayein tab bhi ticket number duplicate nahi hoga.
 */
interface ICounter {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const Counter: Model<ICounter> =
  mongoose.models.Counter || mongoose.model<ICounter>("Counter", CounterSchema);

async function ensureCounterInitialised() {
  const exists = await Counter.exists({ _id: "ticketNumber" });
  if (exists) return;
  // Purane data ke liye: sab se bara existing number dhoond kar counter wahan se shuru karo
  const tickets = mongoose.connection.collection("tickets");
  const [row] = await tickets
    .aggregate<{ max: number }>([
      { $project: { n: { $toInt: { $arrayElemAt: [{ $split: ["$ticketNumber", "-"] }, 1] } } } },
      { $group: { _id: null, max: { $max: "$n" } } },
    ])
    .toArray();
  await Counter.updateOne({ _id: "ticketNumber" }, { $max: { seq: row?.max ?? 0 } }, { upsert: true });
}

export async function nextTicketNumber() {
  await ensureCounterInitialised();
  const counter = await Counter.findOneAndUpdate(
    { _id: "ticketNumber" },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true },
  ).lean();
  return `TKT-${String(counter!.seq).padStart(4, "0")}`;
}
