import type { SeedNode } from './types';

/** Mirrors the official BAC history programa (sessions 2025–2026). Keys are stable seed identifiers. */
export const tree: SeedNode[] = [
  {
    key: 'popoare-spatii-istorice',
    title: 'A. Popoare și spații istorice',
    children: [{ key: 'romanitatea-romanilor', title: 'Romanitatea românilor în viziunea istoricilor' }],
  },
  {
    key: 'oamenii-societatea-ideile',
    title: 'B. Oamenii, societatea și lumea ideilor',
    children: [
      { key: 'secolul-xx-democratie-totalitarism', title: 'Secolul XX: între democrație și totalitarism' },
      { key: 'ideologii-practici-politice', title: 'Ideologii și practici politice în România și Europa' },
      { key: 'constitutiile-din-romania', title: 'Constituțiile din România' },
    ],
  },
  {
    key: 'statul-si-politica',
    title: 'C. Statul și politica',
    children: [
      {
        key: 'autonomii-locale-institutii-centrale',
        title: 'Autonomii locale și instituții centrale (secolele IX–XVIII)',
      },
      {
        key: 'statul-roman-modern-romania-mare',
        title: 'Formarea statului român modern și realizarea României Mari',
      },
      {
        key: 'romania-postbelica',
        title: 'România postbelică: regimul comunist și tranziția democratică',
      },
    ],
  },
  {
    key: 'relatiile-internationale',
    title: 'D. Relațiile internaționale',
    children: [
      {
        key: 'diplomatie-conflict-ev-mediu',
        title: 'Diplomație și conflict în Evul Mediu și modernitate timpurie',
      },
      { key: 'romania-marile-aliante', title: 'România și marile alianțe europene' },
      { key: 'romania-razboiul-rece', title: 'România în contextul Războiului Rece' },
    ],
  },
];
