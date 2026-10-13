export interface UserData {
  login: string;
  nome: string;
  isMaster: boolean;
  isRoot?: boolean;
}

// Reset efetuado: mantendo exclusivamente a matrícula do Soldado Teixeira 1779958 como Master Raiz
export const INITIAL_USERS: UserData[] = [
  { login: '1779958', nome: 'SD TEIXEIRA', isMaster: true, isRoot: true },
];
