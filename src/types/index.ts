export interface Lesson {
  id: number;
  title: string;
  link: string;
  originalImage: string;
  localImage: string;
  meta: string[];
}

export interface FilterState {
  search: string;
  level: string;
  selectedHsk: string[];
  progress: string;
}
