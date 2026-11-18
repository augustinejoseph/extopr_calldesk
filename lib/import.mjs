import { normalizePhone } from "./policy.mjs";
export const importFields = {
  name: "Student name",
  phone: "Mobile number",
  email: "Email",
  course: "Course",
  district: "District",
  sub_district: "Sub district",
  father_name: "Father name",
  gender: "Gender",
  community: "Community",
  student_group: "Group",
  address: "Address",
  pincode: "Pincode",
  school_name: "School name",
};
export function suggestMapping(columns) {
  const aliases = {
    name: ["students name", "student name", "name"],
    phone: ["mobile number", "phone", "mobile"],
    student_group: ["group"],
  };
  return Object.fromEntries(
    Object.entries(importFields).map(([key, label]) => [
      key,
      columns.find((c) =>
        (
          aliases[key] || [label.toLowerCase(), key.replaceAll("_", " ")]
        ).includes(c.trim().toLowerCase()),
      ) || "",
    ]),
  );
}
export function prepareRow(raw, client) {
  const record = Object.fromEntries(
    Object.keys(importFields).map((key) => [
      key,
      String(raw[key] ?? "").trim(),
    ]),
  );
  record.phone = normalizePhone(record.phone);
  if (!record.name) throw Error("Student name is required");
  if (record.phone.length < 10 || record.phone.length > 15)
    throw Error("Phone must contain 10–15 digits");
  if (record.email && !/^\S+@\S+\.\S+$/.test(record.email))
    throw Error("Invalid email");
  if (Object.values(record).some((v) => v.length > 10000))
    throw Error("Field exceeds 10,000 characters");
  return { ...record, client, extra_fields: raw.extra_fields || {} };
}
