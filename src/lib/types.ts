export type CfZone = {
  id: string;
  name: string;
  status: string;
};

export type CfDnsRecord = {
  id: string;
  type: string;
  name: string;
  content: string;
  proxied?: boolean;
  ttl: number;
};

export type BulkAffected = {
  zoneId: string;
  zoneName: string;
  recordId: string;
  name: string;
  type: string;
  ip: string;
  status: "pending" | "success" | "error";
};

export type CfApiResponse<T> = {
  success: boolean;
  result: T;
  result_info?: { total_pages: number; total_count?: number };
  errors?: { message: string }[];
};
