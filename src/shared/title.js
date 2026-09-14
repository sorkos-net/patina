(function exposePatinaTitle(root) {
  "use strict";

  class TitleLayer {
    constructor(initialTitle = "") {
      this.originalTitle = initialTitle;
      this.appliedTitle = null;
    }

    restore(state) {
      if (typeof state?.originalTitle !== "string" || typeof state?.appliedTitle !== "string") {
        return false;
      }
      this.originalTitle = state.originalTitle;
      this.appliedTitle = state.appliedTitle;
      return true;
    }

    snapshot() {
      return {
        originalTitle: this.originalTitle,
        appliedTitle: this.appliedTitle
      };
    }

    capture(currentTitle) {
      if (currentTitle === this.appliedTitle) return this.originalTitle;
      let cleanTitle = currentTitle;
      if (this.appliedTitle && currentTitle.includes(this.appliedTitle)) {
        cleanTitle = currentTitle.replace(this.appliedTitle, this.originalTitle);
      }
      this.originalTitle = cleanTitle;
      return cleanTitle;
    }

    compose(currentTitle, ownedPrefix) {
      this.capture(currentTitle);
      this.appliedTitle = `${ownedPrefix}${this.originalTitle}`;
      return this.appliedTitle;
    }
  }

  root.PatinaTitle = Object.freeze({ TitleLayer });
})(globalThis);
