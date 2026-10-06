import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, Injectable, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy, provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { BUSINESS } from './core/business';

/** "Menu · JLP — Jinisha Lovely Products" style tab titles. */
@Injectable()
class BrandTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  override updateTitle(snapshot: RouterStateSnapshot) {
    const page = this.buildTitle(snapshot);
    this.title.setTitle(page ? `${page} · ${BUSINESS.shortName}` : `${BUSINESS.name} (${BUSINESS.shortName})`);
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top' })),
    provideHttpClient(withInterceptors([authInterceptor])),
    { provide: TitleStrategy, useClass: BrandTitleStrategy },
  ],
};
