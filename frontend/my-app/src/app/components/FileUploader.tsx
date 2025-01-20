import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface FileUploaderProps {
  side: "left" | "right";
}

export default function InputFile({ side }: FileUploaderProps) {
  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <Label htmlFor={`picture-${side}`}>Picture</Label>
      <Input id={`picture-${side}`} type="file" />
    </div>
  )
}
