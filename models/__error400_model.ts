export type Error400Model = {
  status_code: number;
  status_message: string;
  params?: string[];
  example?: string | string[];
};
