export interface INavigationService {
  redirectTo(url: string): void
  replaceWith(url: string): void
}

export class BrowserNavigationService implements INavigationService {
  redirectTo(url: string): void {
    window.location.href = url
  }

  replaceWith(url: string): void {
    window.location.replace(url)
  }
}
