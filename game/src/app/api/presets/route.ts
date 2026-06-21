import { prisma } from "@/lib/db";

export async function GET() {
  const presets = await prisma.preset.findMany({
    include: {
      countries: true,
      regions: true,
    },
  });
  return Response.json(presets);
}
