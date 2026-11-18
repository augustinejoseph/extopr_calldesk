export const statuses = [
  "Pending / Not connected",
  "Wrong / invalid number",
  "Interested",
  "Not interested",
  "Follow-up scheduled",
  "Already contacted — assignment issue",
  "Do not call",
];
export function canAccess(user, student) {
  return user.role === "manager" || student.owner_id === user.id;
}
export function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}
export function validateOutcome(user, student, status, note, due) {
  if (!canAccess(user, student)) throw Error("Access denied");
  if (!statuses.includes(status)) throw Error("Invalid outcome");
  if (
    student.status === "Do not call" &&
    status !== "Do not call" &&
    user.role !== "manager"
  )
    throw Error("Only a manager can remove the do-not-call restriction");
  if (status === "Do not call" && !note.trim())
    throw Error("A do-not-call reason is required");
  if (
    status === "Follow-up scheduled" &&
    (!due ||
      !Number.isFinite(Date.parse(due)) ||
      Date.parse(due) <= Date.now() ||
      !note.trim())
  )
    throw Error("Add a future follow-up time and next-action notes");
}
