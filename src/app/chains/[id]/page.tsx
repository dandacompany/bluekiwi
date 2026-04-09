"use client";

import { useParams } from "next/navigation";
import ChainEditor from "../editor";

export default function EditChainPage() {
  const params = useParams();
  return <ChainEditor chainId={Number(params.id)} />;
}
