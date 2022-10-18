---
layout: page
title: members
permalink: /members/
description: Lab Members
nav: false
nav_order: 2
horizontal: false
display_categories: [PostBac Fellows, PI]
---

<!-- pages/projects.md -->


<div class="projects grid">

  {% assign sorted_members = site.members | sample:100 %}
  {% for member in sorted_members %}
  <div class="grid-item">
    {% if member.redirect %}
    <a href="{{ member.redirect }}" target="_blank">
    {% else %}
    <a href="{{ member.url | relative_url }}">
    {% endif %}
      <div class="card hoverable">
        {% if member.img %}
        <img src="{{ member.img | relative_url }}" alt="member thumbnail">
        {% endif %}
        <div class="card-body">
          <h2 class="card-title">{{ member.name }}</h2>
          <p class="card-title">{{ member.affiliation }}</p>
          <!-- <p class="card-text">{{ member.minibio }}</p> -->
          <br/>
          <div class="row ml-1 mr-1 p-0">
            {% if member.mail %}
            <div class="col-sm-2">
              <div class="icon" data-toggle="tooltip" title="Email">
                <a href="mailto:{{ member.mail | encode_email }}"><i class="fas fa-envelope"></i></a>
              </div>
            </div>
            {% endif %}
            {% if member.website %}
            <div class="col-sm-2">
              <div class="icon" data-toggle="tooltip" title="Website">
                <a href="{{ member.website }}" target="_blank"><i class="fas fa-globe"></i></a>
              </div>
            </div>
            {% endif %}
            {% if member.twitter %}
            <div class="col-sm-2">
              <div class="icon" data-toggle="tooltip" title="Twitter">
                <a href="{{ member.twitter }}" target="_blank"><i class="fab fa-twitter"></i></a>
              </div>
            </div>
            {% endif %}
            {% if member.linkedin %}
            <div class="col-sm-2">
              <div class="icon" data-toggle="tooltip" title="LinkedIn">
                <a href="{{ member.linkedin }}" target="_blank" title="LinkedIn"><i class="fab fa-linkedin"></i></a>
              </div>
            </div>
            {% endif %}
            {% if member.googlescholar %}
            <div class="col-sm-2">
              <div class="icon" data-toggle="tooltip" title="Google Scholar">
                <a href="{{ member.googlescholar }}" target="_blank" title="Google Scholar"><i class="ai ai-google-scholar"></i></a>
              </div>
            </div>
            {% endif %}
            {% if member.github %}
            <div class="col-sm-2">
              <div class="icon" data-toggle="tooltip" title="Code Repository">
                <a href="{{ member.github }}" target="_blank"><i class="fab fa-github gh-icon"></i></a>
              </div>
              {% if member.github_stars %}
              <span class="stars" data-toggle="tooltip" title="GitHub Stars">
                <i class="fas fa-star"></i>
                <span id="{{ member.github_stars }}-stars"></span>
              </span>
              {% endif %}
            </div>
            {% endif %}
          </div>
        </div>
      </div>
    </a>
  </div>
{% endfor %}

</div>